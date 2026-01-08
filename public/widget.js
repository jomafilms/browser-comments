(function() {
  'use strict';

  // Get configuration from script tag (can be overridden by server settings)
  const currentScript = document.currentScript;
  const widgetKey = currentScript?.getAttribute('data-key') || '';

  // Inline overrides (these take precedence over server settings)
  const inlinePosition = currentScript?.getAttribute('data-position');
  const inlineButtonText = currentScript?.getAttribute('data-button-text');
  const inlineColor = currentScript?.getAttribute('data-color');
  const inlineTitle = currentScript?.getAttribute('data-title');
  const inlineSubtitle = currentScript?.getAttribute('data-subtitle');

  const API_BASE = 'https://browser-comments.vercel.app';
  const API_URL = API_BASE + '/api/widget';
  const SETTINGS_URL = API_BASE + '/api/settings';

  if (!widgetKey) {
    console.error('Feedback Widget: Missing data-key attribute');
    return;
  }

  // Default settings
  let config = {
    buttonText: inlineButtonText || 'Feedback',
    buttonPosition: inlinePosition || 'bottom-right',
    primaryColor: inlineColor || '#2563eb',
    modalTitle: inlineTitle || 'Send Feedback',
    modalSubtitle: inlineSubtitle || 'Draw on the screenshot to highlight issues',
    successMessage: 'Your feedback has been submitted!',
  };

  // Fetch settings from server (if available)
  async function loadSettings() {
    try {
      const response = await fetch(SETTINGS_URL + '?key=' + widgetKey);
      if (response.ok) {
        const serverSettings = await response.json();
        // Server settings, but inline attributes take precedence
        config = {
          buttonText: inlineButtonText || serverSettings.buttonText || config.buttonText,
          buttonPosition: inlinePosition || serverSettings.buttonPosition || config.buttonPosition,
          primaryColor: inlineColor || serverSettings.primaryColor || config.primaryColor,
          modalTitle: inlineTitle || serverSettings.modalTitle || config.modalTitle,
          modalSubtitle: inlineSubtitle || serverSettings.modalSubtitle || config.modalSubtitle,
          successMessage: serverSettings.successMessage || config.successMessage,
        };
      }
    } catch (err) {
      console.warn('Feedback Widget: Could not load settings', err);
    }
  }

  // Inject styles
  function injectStyles() {
    const existing = document.getElementById('bc-widget-styles');
    if (existing) existing.remove();

    const styles = document.createElement('style');
    styles.id = 'bc-widget-styles';
    styles.textContent = `
      .bc-widget-btn {
        position: fixed;
        ${config.buttonPosition.includes('bottom') ? 'bottom: 16px;' : 'top: 16px;'}
        ${config.buttonPosition.includes('right') ? 'right: 16px;' : 'left: 16px;'}
        z-index: 999999;
        background: ${config.primaryColor};
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 9999px;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .bc-widget-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0,0,0,0.2);
      }
      .bc-widget-btn:disabled {
        opacity: 0.7;
        cursor: wait;
      }
      .bc-widget-btn svg {
        width: 18px;
        height: 18px;
      }
      .bc-widget-btn .bc-minimize-btn {
        margin-left: 4px;
        padding: 0 4px;
        font-size: 16px;
        line-height: 1;
        opacity: 0.7;
        cursor: pointer;
      }
      .bc-widget-btn .bc-minimize-btn:hover {
        opacity: 1;
      }
      .bc-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.8);
        z-index: 1000000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .bc-modal {
        background: white;
        border-radius: 12px;
        max-width: 900px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      }
      .bc-modal-header {
        padding: 16px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .bc-modal-title {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
        margin: 0;
      }
      .bc-modal-subtitle {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #6b7280;
        margin: 4px 0 0 0;
      }
      .bc-close-btn {
        background: none;
        border: none;
        font-size: 24px;
        color: #6b7280;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      .bc-close-btn:hover {
        color: #1f2937;
      }
      .bc-canvas-container {
        flex: 1;
        overflow: auto;
        padding: 16px;
        background: #f3f4f6;
      }
      .bc-canvas {
        max-width: 100%;
        height: auto;
        cursor: crosshair;
        border: 1px solid #d1d5db;
        border-radius: 4px;
      }
      .bc-toolbar {
        padding: 16px;
        border-top: 1px solid #e5e7eb;
      }
      .bc-tool-row {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 12px;
      }
      .bc-tool-group {
        display: flex;
        gap: 4px;
        padding: 4px;
        background: #f3f4f6;
        border-radius: 8px;
      }
      .bc-tool-btn {
        padding: 8px;
        border: none;
        background: transparent;
        border-radius: 4px;
        cursor: pointer;
        color: #6b7280;
      }
      .bc-tool-btn:hover {
        background: #e5e7eb;
      }
      .bc-tool-btn.active {
        background: ${config.primaryColor}22;
        color: ${config.primaryColor};
      }
      .bc-tool-btn svg {
        width: 18px;
        height: 18px;
      }
      .bc-divider {
        width: 1px;
        height: 32px;
        background: #d1d5db;
      }
      .bc-action-btn {
        padding: 6px 12px;
        border: none;
        background: #e5e7eb;
        border-radius: 4px;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
      }
      .bc-action-btn:hover {
        background: #d1d5db;
      }
      .bc-action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .bc-textarea {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        resize: none;
        margin-bottom: 12px;
      }
      .bc-textarea:focus {
        outline: none;
        border-color: ${config.primaryColor};
        box-shadow: 0 0 0 2px ${config.primaryColor}33;
      }
      .bc-btn-row {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .bc-cancel-btn {
        padding: 10px 16px;
        border: none;
        background: #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
      }
      .bc-cancel-btn:hover {
        background: #d1d5db;
      }
      .bc-submit-btn {
        padding: 10px 16px;
        border: none;
        background: ${config.primaryColor};
        color: white;
        border-radius: 8px;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
      }
      .bc-submit-btn:hover {
        opacity: 0.9;
      }
      .bc-submit-btn:disabled {
        opacity: 0.7;
        cursor: wait;
      }
      .bc-success {
        padding: 32px;
        text-align: center;
      }
      .bc-success-icon {
        font-size: 48px;
        color: #10b981;
        margin-bottom: 16px;
      }
      .bc-success-text {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 16px;
        color: #6b7280;
      }
    `;
    document.head.appendChild(styles);
  }

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
  let comment = '';
  let button = null;
  let isMinimized = localStorage.getItem('bc-widget-minimized') === 'true';

  // Toggle minimized state
  function toggleMinimize(e) {
    e.stopPropagation();
    isMinimized = !isMinimized;
    localStorage.setItem('bc-widget-minimized', isMinimized ? 'true' : 'false');
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
        <span class="bc-btn-text">${config.buttonText}</span>
        <span class="bc-minimize-btn" title="Minimize">−</span>
      `;
      button.onclick = openModal;
      button.style.padding = '10px 16px';

      // Add click handler to minimize button
      const minimizeBtn = button.querySelector('.bc-minimize-btn');
      if (minimizeBtn) {
        minimizeBtn.onclick = toggleMinimize;
      }
    }
  }

  // Load html2canvas-pro dynamically (supports modern CSS color functions like oklch)
  function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      if (window.html2canvas) {
        resolve(window.html2canvas);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas-pro@1.6.4/dist/html2canvas-pro.min.js';
      script.onload = () => {
        if (window.html2canvas) {
          resolve(window.html2canvas);
        } else {
          reject(new Error('html2canvas-pro loaded but not available'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load html2canvas-pro library. Check if cdn.jsdelivr.net is blocked by CSP.'));
      document.head.appendChild(script);
    });
  }

  // Capture screenshot
  async function captureScreenshot() {
    const html2canvas = await loadHtml2Canvas();

    const captureCanvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      scale: window.devicePixelRatio || 1,
      logging: false,
      backgroundColor: '#ffffff',
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      // Handle iframes and fonts
      onclone: (clonedDoc) => {
        // Add font-display fix
        const fontStyle = clonedDoc.createElement('style');
        fontStyle.textContent = '* { font-display: block !important; }';
        clonedDoc.head.appendChild(fontStyle);

        // Find all iframes and overlay with message
        const iframes = clonedDoc.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
          const parent = iframe.parentElement;
          if (parent) {
            const overlay = clonedDoc.createElement('div');
            overlay.style.cssText = `
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: linear-gradient(135deg, #f0f0f0 25%, #e0e0e0 25%, #e0e0e0 50%, #f0f0f0 50%, #f0f0f0 75%, #e0e0e0 75%);
              background-size: 20px 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: #666;
              font-size: 14px;
              text-align: center;
              padding: 20px;
              z-index: 1000;
            `;
            overlay.innerHTML = `
              <div style="background: white; padding: 16px 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="font-weight: bold; margin-bottom: 8px;">Embedded Content</div>
                <div style="font-size: 12px; color: #888;">Content not captured in screenshot.<br/>Use annotations to describe the issue.</div>
              </div>
            `;
            const parentStyle = window.getComputedStyle(parent);
            if (parentStyle.position === 'static') {
              parent.style.position = 'relative';
            }
            parent.appendChild(overlay);
          }
        });
      },
    });
    return captureCanvas.toDataURL('image/png');
  }

  // Open modal
  async function openModal() {
    if (isCapturing) return;
    isCapturing = true;
    button.disabled = true;
    button.innerHTML = `<span>Capturing...</span>`;

    try {
      screenshot = await captureScreenshot();
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
    isCapturing = false;
    button.disabled = false;
  }

  // Close modal
  function closeModal() {
    isOpen = false;
    screenshot = null;
    annotations = [];
    currentAnnotation = null;
    comment = '';
    submitted = false;
    const overlay = document.querySelector('.bc-modal-overlay');
    if (overlay) overlay.remove();
    updateButton(); // Restore button to normal state
  }

  // Drawing helpers
  function drawArrow(ctx, from, to) {
    const headLength = 15;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y + headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  function drawAnnotation(ctx, ann) {
    if (ann.points.length < 2) return;
    if (ann.type === 'draw') {
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x, ann.points[0].y);
      ann.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (ann.type === 'arrow') {
      drawArrow(ctx, ann.points[0], ann.points[ann.points.length - 1]);
    } else if (ann.type === 'rectangle') {
      const from = ann.points[0];
      const to = ann.points[ann.points.length - 1];
      ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
    }
  }

  function redrawCanvas() {
    if (!canvas || !ctx || !screenshot) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      annotations.forEach(ann => drawAnnotation(ctx, ann));
      if (currentAnnotation) drawAnnotation(ctx, currentAnnotation);
    };
    img.src = screenshot;
  }

  function getCanvasPoint(e, canvasEl) {
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // Submit feedback
  async function submitFeedback() {
    if (!canvas) return;
    isSubmitting = true;
    renderModal();

    try {
      // Use JPEG with 0.8 quality to reduce payload size (PNG can exceed Vercel's 4.5MB limit)
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetKey,
          url: window.location.href,
          imageData,
          textAnnotations: comment ? [{ text: comment, x: 0, y: 0, color: '#000000' }] : [],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit');
      }

      submitted = true;
      renderModal();
      setTimeout(closeModal, 2000);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      alert(err.message || 'Failed to submit feedback. Please try again.');
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
      overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
      document.body.appendChild(overlay);
    }

    if (submitted) {
      overlay.innerHTML = `
        <div class="bc-modal">
          <div class="bc-modal-header">
            <div>
              <h2 class="bc-modal-title">Thank you!</h2>
            </div>
            <button class="bc-close-btn" onclick="document.querySelector('.bc-modal-overlay').remove()">&times;</button>
          </div>
          <div class="bc-success">
            <div class="bc-success-icon">✓</div>
            <p class="bc-success-text">${config.successMessage}</p>
          </div>
        </div>
      `;
      return;
    }

    overlay.innerHTML = `
      <div class="bc-modal">
        <div class="bc-modal-header">
          <div>
            <h2 class="bc-modal-title">${config.modalTitle}</h2>
            <p class="bc-modal-subtitle">${config.modalSubtitle}</p>
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
            </div>
            <div class="bc-divider"></div>
            <button class="bc-action-btn" id="bc-undo" ${annotations.length === 0 ? 'disabled' : ''}>Undo</button>
            <button class="bc-action-btn" id="bc-clear" ${annotations.length === 0 ? 'disabled' : ''}>Clear</button>
          </div>
          <textarea class="bc-textarea" placeholder="Add a comment (optional)..." rows="2" id="bc-comment">${comment}</textarea>
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
    overlay.querySelector('.bc-close-btn').onclick = closeModal;
    overlay.querySelector('.bc-cancel-btn').onclick = closeModal;
    overlay.querySelector('.bc-submit-btn').onclick = submitFeedback;

    overlay.querySelectorAll('.bc-tool-btn').forEach(btn => {
      btn.onclick = () => {
        activeTool = btn.dataset.tool;
        renderModal();
      };
    });

    overlay.querySelector('#bc-undo').onclick = () => {
      annotations.pop();
      redrawCanvas();
      renderModal();
    };

    overlay.querySelector('#bc-clear').onclick = () => {
      annotations = [];
      redrawCanvas();
      renderModal();
    };

    overlay.querySelector('#bc-comment').oninput = (e) => {
      comment = e.target.value;
    };

    // Canvas drawing events
    canvas.onmousedown = canvas.ontouchstart = (e) => {
      e.preventDefault();
      isDrawing = true;
      const point = getCanvasPoint(e, canvas);
      currentAnnotation = { type: activeTool, points: [point] };
    };

    canvas.onmousemove = canvas.ontouchmove = (e) => {
      if (!isDrawing || !currentAnnotation) return;
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
      renderModal();
    };
  }

  // Initialize - wait for settings before showing button
  async function init() {
    await loadSettings();
    injectStyles();
    updateButton();
  }
  init();
})();
