import { widgetKey, API_URL, inlineUserName, inlineUserEmail } from './env.js';
import { esc, safeColor, lsGet, lsSet, NAME_KEY, COLOR_KEY, ANNOTATION_COLORS, DEFAULT_ANNOTATION_COLOR } from './utils.js';
import { config, loadSettings } from './settings.js';
import { isDarkMode, injectStyles } from './theme.js';
import { DEVICE_CATEGORIES, detectedUA, detectedScreenW, detectedScreenH, detectedCategory, detectedModel } from './device.js';
import { captureScreenshot } from './capture.js';
import { drawAnnotation, drawTextOnCanvas, getCanvasPoint } from './draw.js';

// State
let isOpen = false;
let isCapturing = false;
let isSubmitting = false;
let submitted = false;
let screenshot = null;
let canvas = null;
let ctx = null;
let activeTool = 'draw';
let isDrawing = false;
let annotations = [];
let currentAnnotation = null;
let textAnnotations = []; // { x, y, text, color }
let activeColor = safeColor(lsGet(COLOR_KEY), DEFAULT_ANNOTATION_COLOR); // last-used, default orange
let colorPickerOpen = false;
let comment = '';
let submitterName = inlineUserName || inlineUserEmail || lsGet(NAME_KEY) || '';
let deviceCategory = detectedCategory;
let deviceModel = detectedModel;
let button = null;
let preCapturePromise = null; // screenshot capture started on mousedown
let isMinimized = lsGet('bc-widget-minimized') === 'true';
let errorMessage = ''; // inline form error (submit failures, validation)
let lastTicketRef = ''; // ref returned by the API on successful submit
let autoCloseTimer = null; // success-view auto-close; cancelled on manual close
let lastDarkMode = null; // track dark mode changes

// Watch for dark mode toggles on <html> and <body> (class/attribute changes).
// Set up from init() — not at module load — so nothing observes the page when
// the widget key is missing and the widget never boots.
function watchDarkMode() {
  const darkModeObserver = new MutationObserver(() => {
    const dark = isDarkMode();
    if (dark !== lastDarkMode) {
      lastDarkMode = dark;
      injectStyles();
    }
  });
  darkModeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-mode'] });
  if (document.body) {
    darkModeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
}

// Toggle minimized state
function toggleMinimize(e) {
  e.stopPropagation();
  isMinimized = !isMinimized;
  lsSet('bc-widget-minimized', isMinimized ? 'true' : 'false');
  updateButton();
}

// Create/update button
function updateButton() {
  injectStyles();

  if (!button) {
    button = document.createElement('button');
    button.className = 'bc-widget-btn';
    document.body.appendChild(button);
  }

  if (isMinimized) {
    // Minimized: just icon, click to expand
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
    button.onclick = toggleMinimize;
    button.style.padding = '10px';
  } else {
    // Expanded: icon + text + minimize button
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bc-main-icon">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="bc-btn-text">${esc(config.buttonText)}</span>
      <span class="bc-minimize-btn" title="Minimize">−</span>
    `;
    button.onclick = (e) => { e.stopPropagation(); openModal(); };
    // Pre-capture screenshot on mousedown, before click propagates and closes
    // any open modals/dropdowns on the page via click-outside handlers
    const startPreCapture = (e) => {
      if (isCapturing || isOpen) return;
      e.preventDefault(); // prevent focus shift that might close modals
      // Start capture immediately — openModal will await this promise
      preCapturePromise = captureScreenshot().catch(() => null);
    };
    button.onmousedown = startPreCapture;
    // Touch path: preventDefault on touchstart suppresses iOS's synthetic
    // click, so we drive open/minimize from touchend ourselves. Without this,
    // taps on iPhone/iPad often do nothing.
    let touchStartXY = null;
    button.ontouchstart = (e) => {
      const onMinimize = e.target.closest('.bc-minimize-btn');
      const t = e.touches[0];
      touchStartXY = t ? { x: t.clientX, y: t.clientY } : null;
      if (onMinimize) return; // let minimize tap behave normally
      if (isCapturing || isOpen) return;
      e.preventDefault();
      preCapturePromise = captureScreenshot().catch(() => null);
    };
    button.ontouchend = (e) => {
      // Reject swipes — only treat as a tap if finger barely moved
      const t = e.changedTouches && e.changedTouches[0];
      if (touchStartXY && t) {
        const dx = t.clientX - touchStartXY.x;
        const dy = t.clientY - touchStartXY.y;
        if (Math.hypot(dx, dy) > 20) { touchStartXY = null; return; }
      }
      touchStartXY = null;
      if (e.target.closest('.bc-minimize-btn')) {
        e.preventDefault();
        toggleMinimize(e);
        return;
      }
      if (isOpen) return;
      e.preventDefault(); // also suppresses the synthetic click that follows
      openModal();
    };
    button.style.padding = '10px 16px';

    // Add click handler to minimize button (mouse / non-touch path)
    const minimizeBtn = button.querySelector('.bc-minimize-btn');
    if (minimizeBtn) {
      minimizeBtn.onclick = toggleMinimize;
    }
  }
}

// Open modal
async function openModal() {
  if (isCapturing) return;
  isCapturing = true;
  button.disabled = true;
  button.innerHTML = `<span class="bc-spinner"></span><span>Capturing…</span>`;

  try {
    // Await the capture started on mousedown (preserves modals/dropdowns
    // that close on click), or capture fresh if no mousedown preceded this
    if (preCapturePromise) {
      screenshot = await preCapturePromise;
      preCapturePromise = null;
    }
    if (!screenshot) {
      screenshot = await captureScreenshot();
    }
  } catch (err) {
    console.error('Failed to capture screenshot:', err);
    // Create a placeholder image instead of failing
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, 800, 400);
    ctx.fillStyle = '#6b7280';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Screenshot could not be captured', 400, 180);
    ctx.fillText('Please describe the issue in your comment', 400, 210);
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('(' + (err.message || 'Unknown error') + ')', 400, 250);
    screenshot = canvas.toDataURL('image/png');
  }

  isOpen = true;
  renderModal();
  document.addEventListener('keydown', onEscapeKey);
  isCapturing = false;
  button.disabled = false;
  updateButton(); // restore button label behind the overlay
}

// Close modal. Accidental dismissals (Escape, click-outside, ×) keep the
// typed comment in memory so reopening doesn't lose work; explicit Cancel
// and a finished submit clear it. Draft is memory-only by design — a
// persisted draft would pair stale text with a fresh screenshot.
function closeModal(opts) {
  // Cancel the pending success auto-close so it can't fire into a modal the
  // user reopened in the meantime
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
  if ((opts && opts.clearDraft) || submitted) comment = '';
  isOpen = false;
  screenshot = null;
  preCapturePromise = null;
  annotations = [];
  currentAnnotation = null;
  textAnnotations = [];
  colorPickerOpen = false;
  submitted = false;
  errorMessage = '';
  document.removeEventListener('keydown', onEscapeKey);
  const overlay = document.querySelector('.bc-modal-overlay');
  if (overlay) overlay.remove();
  updateButton(); // Restore button to normal state
}

// Escape closes the modal (comment draft is kept). If the user is typing a
// text annotation, the first Escape just leaves that textarea.
function onEscapeKey(e) {
  if (e.key !== 'Escape' || !isOpen || isSubmitting) return;
  const el = document.activeElement;
  if (el && el.classList && el.classList.contains('bc-text-annotation')) {
    el.blur();
    return;
  }
  closeModal();
}

function redrawCanvas() {
  if (!canvas || !ctx || !screenshot) return;
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    annotations.forEach(ann => {
      ctx.strokeStyle = ann.color || '#f97316';
      drawAnnotation(ctx, ann);
    });
    if (currentAnnotation) {
      ctx.strokeStyle = currentAnnotation.color || activeColor;
      drawAnnotation(ctx, currentAnnotation);
    }
    // Text annotations are shown as HTML elements, not drawn on canvas
    // They get drawn on the final image during submit
  };
  img.src = screenshot;
}

// Update toolbar button states without re-rendering
function updateToolbarState(overlay) {
  const undoBtn = overlay.querySelector('#bc-undo');
  const clearBtn = overlay.querySelector('#bc-clear');
  const hasContent = annotations.length > 0 || textAnnotations.length > 0;
  if (undoBtn) undoBtn.disabled = !hasContent;
  if (clearBtn) clearBtn.disabled = !hasContent;
}

// Inline form error (replaces alert(), which blocks the page)
function showFormError(message) {
  errorMessage = message || '';
  const el = document.querySelector('#bc-error');
  if (el) {
    el.textContent = errorMessage;
    el.hidden = !errorMessage;
  }
}

// Submit feedback
async function submitFeedback() {
  if (!canvas || isSubmitting) return;

  // Validate name is provided
  const nameInput = document.querySelector('#bc-name');
  if (!submitterName.trim()) {
    showFormError('Please enter your name.');
    if (nameInput) {
      nameInput.classList.add('bc-input-error');
      nameInput.focus();
    }
    return;
  }
  if (nameInput) nameInput.classList.remove('bc-input-error');
  showFormError('');

  isSubmitting = true;
  const submitBtn = document.querySelector('.bc-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
  }

  try {
    // Export from a copy so a failed submit doesn't stamp text annotations
    // onto the visible canvas (a retry would then draw them twice)
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.drawImage(canvas, 0, 0);
    textAnnotations.forEach(ta => {
      if (ta.text && ta.text.trim()) {
        drawTextOnCanvas(exportCtx, ta);
      }
    });

    // Use JPEG with 0.8 quality to reduce payload size (PNG can exceed Vercel's 4.5MB limit)
    const imageData = exportCanvas.toDataURL('image/jpeg', 0.8);

    // Combine canvas text annotations with comment
    const allTextAnnotations = [];

    // Add canvas text annotations (from text tool)
    textAnnotations.forEach(ta => {
      if (ta.text && ta.text.trim()) {
        allTextAnnotations.push({ text: ta.text, x: ta.x, y: ta.y, color: ta.color });
      }
    });

    // Add comment as a text annotation (at position 0,0 to indicate it's the main comment)
    if (comment && comment.trim()) {
      allTextAnnotations.push({ text: comment, x: 0, y: 0, color: '#000000' });
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widgetKey,
        url: window.location.href,
        imageData,
        textAnnotations: allTextAnnotations,
        submitterName: submitterName.trim(),
        userAgent: detectedUA,
        viewportW: detectedScreenW,
        viewportH: detectedScreenH,
        deviceCategory: deviceCategory || null,
        deviceModel: deviceModel.trim() || null,
      }),
    });

    let data = null;
    try { data = await response.json(); } catch (e) { /* non-JSON response */ }

    if (!response.ok) {
      throw new Error((data && data.error) || 'Failed to submit');
    }

    lsSet(NAME_KEY, submitterName.trim());
    lastTicketRef = (data && data.ref) || ''; // present once the API returns per-project refs
    submitted = true;
    renderModal();
    // Leave the ref on screen long enough to read
    autoCloseTimer = setTimeout(closeModal, lastTicketRef ? 4000 : 2000);
  } catch (err) {
    console.error('Failed to submit feedback:', err);
    // Keep the annotated image + comment in place so a retry loses nothing
    const isNetworkError = navigator.onLine === false || err instanceof TypeError;
    showFormError(isNetworkError
      ? 'Network error — your feedback is still here. Check your connection and try again.'
      : (err.message || 'Failed to submit feedback. Please try again.'));
    // Restore button state on error
    const submitBtnAfter = document.querySelector('.bc-submit-btn');
    if (submitBtnAfter) {
      submitBtnAfter.disabled = false;
      submitBtnAfter.textContent = 'Submit Feedback';
    }
  } finally {
    isSubmitting = false;
  }
}

// Render modal
function renderModal() {
  let overlay = document.querySelector('.bc-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'bc-modal-overlay';
    overlay.onclick = (e) => { e.stopPropagation(); if (e.target === overlay) closeModal(); };
    document.body.appendChild(overlay);
  }

  if (submitted) {
    overlay.innerHTML = `
      <div class="bc-modal">
        <div class="bc-modal-header">
          <div>
            <h2 class="bc-modal-title">Thank you!</h2>
          </div>
          <button class="bc-close-btn">&times;</button>
        </div>
        <div class="bc-success">
          <div class="bc-success-icon">✓</div>
          <p class="bc-success-text">${esc(config.successMessage)}</p>
          ${lastTicketRef ? `<p class="bc-success-ref">Your ticket: ${esc(lastTicketRef)}</p>` : ''}
        </div>
      </div>
    `;
    overlay.querySelector('.bc-close-btn').onclick = () => closeModal();
    return;
  }

  overlay.innerHTML = `
    <div class="bc-modal">
      <div class="bc-modal-header">
        <div>
          <h2 class="bc-modal-title">${esc(config.modalTitle)}</h2>
          <p class="bc-modal-subtitle">${esc(config.modalSubtitle)}</p>
        </div>
        <button class="bc-close-btn">&times;</button>
      </div>
      <div class="bc-canvas-container">
        <canvas class="bc-canvas"></canvas>
      </div>
      <div class="bc-toolbar">
        <div class="bc-tool-row">
          <div class="bc-tool-group">
            <button class="bc-tool-btn ${activeTool === 'draw' ? 'active' : ''}" data-tool="draw" title="Freehand">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              </svg>
            </button>
            <button class="bc-tool-btn ${activeTool === 'arrow' ? 'active' : ''}" data-tool="arrow" title="Arrow">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
            <button class="bc-tool-btn ${activeTool === 'rectangle' ? 'active' : ''}" data-tool="rectangle" title="Rectangle">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
            </button>
            <button class="bc-tool-btn ${activeTool === 'text' ? 'active' : ''}" data-tool="text" title="Text">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 7 4 4 20 4 20 7"></polyline>
                <line x1="9" y1="20" x2="15" y2="20"></line>
                <line x1="12" y1="4" x2="12" y2="20"></line>
              </svg>
            </button>
          </div>
          <div class="bc-divider"></div>
          <div class="bc-color-picker" id="bc-color-picker">
            <div class="bc-color-dot" style="background: ${activeColor};" title="Color"></div>
          </div>
          <div class="bc-divider"></div>
          <button class="bc-action-btn" id="bc-undo" ${annotations.length === 0 && textAnnotations.length === 0 ? 'disabled' : ''}>Undo</button>
          <button class="bc-action-btn" id="bc-clear" ${annotations.length === 0 && textAnnotations.length === 0 ? 'disabled' : ''}>Clear</button>
        </div>
        <input type="text" class="bc-name-input" placeholder="Your name *" id="bc-name" value="${esc(submitterName)}" ${inlineUserName || inlineUserEmail ? 'readonly' : ''} required />
        <div class="bc-device-row">
          <select class="bc-device-select" id="bc-device-category" title="Browser / device">
            ${DEVICE_CATEGORIES.map(c => `<option value="${c}" ${c === deviceCategory ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <input type="text" class="bc-device-model" id="bc-device-model" placeholder="Model/version (optional)" value="${esc(deviceModel)}" />
        </div>
        <textarea class="bc-textarea" placeholder="Add a comment (optional)..." rows="2" id="bc-comment">${esc(comment)}</textarea>
        <div class="bc-form-error" id="bc-error" ${errorMessage ? '' : 'hidden'}>${esc(errorMessage)}</div>
        <div class="bc-btn-row">
          <button class="bc-cancel-btn">Cancel</button>
          <button class="bc-submit-btn" ${isSubmitting ? 'disabled' : ''}>${isSubmitting ? 'Submitting...' : 'Submit Feedback'}</button>
        </div>
      </div>
    </div>
  `;

  // Setup canvas
  canvas = overlay.querySelector('.bc-canvas');
  ctx = canvas.getContext('2d');
  redrawCanvas();

  // Event listeners
  overlay.querySelector('.bc-close-btn').onclick = () => closeModal();
  overlay.querySelector('.bc-cancel-btn').onclick = () => closeModal({ clearDraft: true });
  overlay.querySelector('.bc-submit-btn').onclick = submitFeedback;

  overlay.querySelectorAll('.bc-tool-btn').forEach(btn => {
    btn.onclick = () => {
      activeTool = btn.dataset.tool;
      // Update active class without re-rendering
      overlay.querySelectorAll('.bc-tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === activeTool);
      });
      // Update cursor for text tool
      if (canvas) {
        canvas.style.cursor = activeTool === 'text' ? 'text' : 'crosshair';
      }
    };
  });

  // Color picker
  const colorPicker = overlay.querySelector('#bc-color-picker');
  const colorDot = colorPicker.querySelector('.bc-color-dot');
  colorDot.onclick = (e) => {
    e.stopPropagation();
    colorPickerOpen = !colorPickerOpen;
    renderColorPicker(colorPicker);
  };

  function renderColorPicker(container) {
    const existingOptions = container.querySelector('.bc-color-options');
    if (existingOptions) existingOptions.remove();

    if (colorPickerOpen) {
      const optionsHtml = `
        <div class="bc-color-options">
          ${ANNOTATION_COLORS.map(c => `<div class="bc-color-option ${activeColor === c ? 'active' : ''}" style="background: ${c};" data-color="${c}"></div>`).join('')}
        </div>
      `;
      container.insertAdjacentHTML('beforeend', optionsHtml);

      container.querySelectorAll('.bc-color-option').forEach(opt => {
        opt.onclick = (e) => {
          e.stopPropagation();
          activeColor = opt.dataset.color;
          lsSet(COLOR_KEY, activeColor); // remember for next time
          colorPickerOpen = false;
          colorDot.style.background = activeColor;
          renderColorPicker(container);
        };
      });
    }
  }

  // Close color picker when clicking elsewhere
  overlay.addEventListener('click', () => {
    if (colorPickerOpen) {
      colorPickerOpen = false;
      renderColorPicker(colorPicker);
    }
  });

  overlay.querySelector('#bc-undo').onclick = () => {
    // Undo last action (text or drawing annotation) based on timestamp
    const lastText = textAnnotations.length > 0 ? textAnnotations[textAnnotations.length - 1] : null;
    const lastDraw = annotations.length > 0 ? annotations[annotations.length - 1] : null;

    if (lastText && (!lastDraw || lastText.timestamp > lastDraw.timestamp)) {
      const removed = textAnnotations.pop();
      if (removed && removed.element) removed.element.remove();
    } else if (lastDraw) {
      annotations.pop();
    }
    redrawCanvas();
    updateToolbarState(overlay);
  };

  overlay.querySelector('#bc-clear').onclick = () => {
    // Remove all text annotation elements from DOM
    textAnnotations.forEach(ta => {
      if (ta.element) ta.element.remove();
    });
    annotations = [];
    textAnnotations = [];
    redrawCanvas();
    updateToolbarState(overlay);
  };

  overlay.querySelector('#bc-name').oninput = (e) => {
    submitterName = e.target.value;
    if (submitterName.trim()) e.target.classList.remove('bc-input-error');
  };

  overlay.querySelector('#bc-device-category').onchange = (e) => {
    deviceCategory = e.target.value;
  };

  overlay.querySelector('#bc-device-model').oninput = (e) => {
    deviceModel = e.target.value;
  };

  overlay.querySelector('#bc-comment').oninput = (e) => {
    comment = e.target.value;
  };

  // Pinch-zoom on the screenshot canvas (mobile). Tracked at container level
  // so both fingers don't have to land on the canvas itself.
  const canvasContainerEl = overlay.querySelector('.bc-canvas-container');
  let pinchStartDist = 0;
  let pinchStartWidth = 0;
  const touchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };
  canvasContainerEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinchStartDist = touchDistance(e.touches);
      pinchStartWidth = canvas.getBoundingClientRect().width;
      e.preventDefault();
    }
  }, { passive: false });
  canvasContainerEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchStartDist > 0) {
      const d = touchDistance(e.touches);
      const minW = 80;
      const maxW = canvas.width * 4;
      const newW = Math.max(minW, Math.min(maxW, pinchStartWidth * (d / pinchStartDist)));
      canvas.style.width = newW + 'px';
      canvas.style.height = (newW / canvas.width * canvas.height) + 'px';
      canvas.style.maxWidth = 'none';
      e.preventDefault();
    }
  }, { passive: false });
  canvasContainerEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinchStartDist = 0;
  });

  // Canvas drawing events
  canvas.onmousedown = canvas.ontouchstart = (e) => {
    // Ignore second/third fingers — those are for pinch, not drawing
    if (e.touches && e.touches.length > 1) return;
    e.preventDefault();
    const point = getCanvasPoint(e, canvas);

    if (activeTool === 'text') {
      // Create text annotation with drag/drop and resize
      const container = overlay.querySelector('.bc-canvas-container');
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / canvas.width;
      const scaleY = rect.height / canvas.height;

      const screenX = point.x * scaleX;
      const screenY = point.y * scaleY;

      // Create wrapper for drag
      const wrapper = document.createElement('div');
      wrapper.className = 'bc-text-wrapper';
      wrapper.style.left = screenX + 'px';
      wrapper.style.top = screenY + 'px';

      // Create textarea
      const input = document.createElement('textarea');
      input.className = 'bc-text-annotation';
      input.style.borderColor = activeColor;
      input.style.color = activeColor;
      input.rows = 2;
      input.placeholder = 'Type here...';

      // Create delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'bc-text-delete';
      deleteBtn.innerHTML = '×';

      // Create resize handle
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'bc-text-resize';

      wrapper.appendChild(input);
      wrapper.appendChild(deleteBtn);
      wrapper.appendChild(resizeHandle);
      container.appendChild(wrapper);

      input.focus();

      // Store reference
      const textAnn = { x: point.x, y: point.y, text: '', color: activeColor, timestamp: Date.now(), element: wrapper, width: 100, height: 50 };
      textAnnotations.push(textAnn);

      // Update text on input
      input.oninput = () => {
        textAnn.text = input.value;
      };

      // Remove if empty on blur
      input.onblur = () => {
        if (!textAnn.text.trim()) {
          wrapper.remove();
          const idx = textAnnotations.indexOf(textAnn);
          if (idx > -1) textAnnotations.splice(idx, 1);
        }
        redrawCanvas();
        updateToolbarState(overlay);
      };

      // Delete button
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        wrapper.remove();
        const idx = textAnnotations.indexOf(textAnn);
        if (idx > -1) textAnnotations.splice(idx, 1);
        redrawCanvas();
        updateToolbarState(overlay);
      };

      // Drag functionality (mouse + touch)
      let isDragging = false;
      let dragOffsetX = 0;
      let dragOffsetY = 0;

      const startDrag = (e) => {
        const target = e.target || (e.touches && document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY));
        if (target === input || target === deleteBtn || target === resizeHandle) return;
        isDragging = true;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        dragOffsetX = cx - wrapper.offsetLeft;
        dragOffsetY = cy - wrapper.offsetTop;
        e.preventDefault();
      };
      wrapper.onmousedown = startDrag;
      wrapper.ontouchstart = startDrag;

      const moveDrag = (e) => {
        if (!isDragging) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const newX = cx - dragOffsetX;
        const newY = cy - dragOffsetY;
        wrapper.style.left = newX + 'px';
        wrapper.style.top = newY + 'px';
        textAnn.x = newX / scaleX;
        textAnn.y = newY / scaleY;
      };
      document.addEventListener('mousemove', moveDrag);
      document.addEventListener('touchmove', moveDrag, { passive: false });

      const endDrag = () => { isDragging = false; };
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchend', endDrag);

      // Resize functionality (mouse + touch)
      let isResizing = false;
      let startWidth = 0;
      let startHeight = 0;
      let startX = 0;
      let startY = 0;

      const startResize = (e) => {
        isResizing = true;
        startWidth = input.offsetWidth;
        startHeight = input.offsetHeight;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        e.preventDefault();
        e.stopPropagation();
      };
      resizeHandle.onmousedown = startResize;
      resizeHandle.ontouchstart = startResize;

      const moveResize = (e) => {
        if (!isResizing) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const newWidth = Math.max(100, startWidth + (cx - startX));
        const newHeight = Math.max(40, startHeight + (cy - startY));
        input.style.width = newWidth + 'px';
        input.style.height = newHeight + 'px';
        textAnn.width = newWidth / scaleX;
        textAnn.height = newHeight / scaleY;
      };
      document.addEventListener('mousemove', moveResize);
      document.addEventListener('touchmove', moveResize, { passive: false });

      const endResize = () => { isResizing = false; };
      document.addEventListener('mouseup', endResize);
      document.addEventListener('touchend', endResize);

      return;
    }

    isDrawing = true;
    currentAnnotation = { type: activeTool, points: [point], color: activeColor, timestamp: Date.now() };
  };

  canvas.onmousemove = canvas.ontouchmove = (e) => {
    if (!isDrawing || !currentAnnotation) return;
    // Bail out mid-stroke if a second finger lands (pinch-zoom takes over)
    if (e.touches && e.touches.length > 1) { isDrawing = false; currentAnnotation = null; return; }
    e.preventDefault();
    const point = getCanvasPoint(e, canvas);
    if (activeTool === 'draw') {
      currentAnnotation.points.push(point);
    } else {
      currentAnnotation.points = [currentAnnotation.points[0], point];
    }
    redrawCanvas();
  };

  canvas.onmouseup = canvas.onmouseleave = canvas.ontouchend = () => {
    if (currentAnnotation && currentAnnotation.points.length > 1) {
      annotations.push(currentAnnotation);
    }
    currentAnnotation = null;
    isDrawing = false;
    redrawCanvas();
    updateToolbarState(overlay);
  };
}

// Initialize - wait for settings before showing button
async function init() {
  await loadSettings();
  injectStyles();
  updateButton();
  watchDarkMode();
}

export { init };
