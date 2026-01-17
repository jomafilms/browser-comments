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
  const inlineUserName = currentScript?.getAttribute('data-user-name');
  const inlineUserEmail = currentScript?.getAttribute('data-user-email');

  // Auto-detect API base - use current origin for local testing
  const scriptSrc = currentScript?.src || '';
  const API_BASE = scriptSrc.includes('localhost') || scriptSrc.startsWith('/')
    ? window.location.origin
    : 'https://browser-comments.vercel.app';
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

  // Cache settings to reduce database calls
  const CACHE_KEY = 'bc-settings-' + widgetKey;
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  // Check if all customizable settings are provided via attributes (skip server fetch entirely)
  function hasAllInlineSettings() {
    return inlineButtonText && inlinePosition && inlineColor && inlineTitle && inlineSubtitle;
  }

  function applySettings(serverSettings) {
    config = {
      buttonText: inlineButtonText || serverSettings.buttonText || config.buttonText,
      buttonPosition: inlinePosition || serverSettings.buttonPosition || config.buttonPosition,
      primaryColor: inlineColor || serverSettings.primaryColor || config.primaryColor,
      modalTitle: inlineTitle || serverSettings.modalTitle || config.modalTitle,
      modalSubtitle: inlineSubtitle || serverSettings.modalSubtitle || config.modalSubtitle,
      successMessage: serverSettings.successMessage || config.successMessage,
    };
  }

  // Fetch settings from server (with localStorage caching)
  async function loadSettings() {
    // If all settings are provided inline, skip server fetch entirely (zero DB calls)
    if (hasAllInlineSettings()) {
      return;
    }

    // Check localStorage cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          applySettings(data);
          return; // Use cached settings, no server call needed
        }
      }
    } catch (e) {
      // localStorage not available or parse error, continue to fetch
    }

    // Fetch from server and cache the result
    try {
      const response = await fetch(SETTINGS_URL + '?key=' + widgetKey);
      if (response.ok) {
        const serverSettings = await response.json();
        applySettings(serverSettings);

        // Cache the settings
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: serverSettings,
            timestamp: Date.now()
          }));
        } catch (e) {
          // localStorage full or not available, continue without caching
        }
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
        position: relative;
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
      .bc-name-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        margin-bottom: 8px;
        box-sizing: border-box;
      }
      .bc-name-input:focus {
        outline: none;
        border-color: ${config.primaryColor};
        box-shadow: 0 0 0 2px ${config.primaryColor}33;
      }
      .bc-name-input[readonly] {
        background: #f3f4f6;
        color: #6b7280;
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
        box-sizing: border-box;
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
      .bc-color-picker {
        position: relative;
        display: flex;
        align-items: center;
      }
      .bc-color-dot {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 0 0 1px #d1d5db;
        transition: transform 0.15s;
      }
      .bc-color-dot:hover {
        transform: scale(1.1);
      }
      .bc-color-options {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        border-radius: 8px;
        padding: 6px;
        display: flex;
        gap: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        margin-bottom: 8px;
      }
      .bc-color-options::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: white;
      }
      .bc-color-option {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid transparent;
        transition: transform 0.15s;
      }
      .bc-color-option:hover {
        transform: scale(1.15);
      }
      .bc-color-option.active {
        border-color: #1f2937;
      }
      .bc-text-wrapper {
        position: absolute;
        cursor: move;
        padding: 10px;
        border-radius: 8px;
        margin: -10px;
      }
      .bc-text-wrapper:hover {
        background: rgba(0,0,0,0.05);
      }
      .bc-text-annotation {
        min-width: 100px;
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid;
        border-radius: 4px;
        padding: 6px 10px 12px 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        resize: none;
        outline: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        box-sizing: border-box;
        cursor: text;
        display: block;
      }
      .bc-text-annotation:focus {
        box-shadow: 0 2px 12px rgba(0,0,0,0.2);
      }
      .bc-text-delete {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 18px;
        height: 18px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.15s;
        z-index: 10;
      }
      .bc-text-wrapper:hover .bc-text-delete {
        opacity: 1;
      }
      .bc-text-resize {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 14px;
        height: 14px;
        background: #9ca3af;
        border-radius: 2px;
        cursor: nwse-resize;
        opacity: 0;
        transition: opacity 0.15s;
        z-index: 10;
      }
      .bc-text-wrapper:hover .bc-text-resize {
        opacity: 0.8;
      }
      .bc-text-resize:hover {
        background: #6b7280;
        opacity: 1 !important;
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
  let textAnnotations = []; // { x, y, text, color }
  let activeColor = '#f97316'; // Default orange
  let colorPickerOpen = false;
  let comment = '';
  let submitterName = inlineUserName || inlineUserEmail || '';
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

  // Load html2canvas-pro dynamically (supports oklch, lab, lch, oklab colors)
  function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.html2canvas && typeof window.html2canvas === 'function') {
        resolve(window.html2canvas);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas-pro@1.6.4/dist/html2canvas-pro.min.js';

      script.onload = () => {
        // html2canvas-pro may export as object with default property
        let fn = window.html2canvas;

        // If it's an object with default, use that
        if (fn && typeof fn !== 'function' && fn.default) {
          fn = fn.default;
        }

        // Also check for html2canvas property on the object
        if (fn && typeof fn !== 'function' && fn.html2canvas) {
          fn = fn.html2canvas;
        }

        if (typeof fn === 'function') {
          // Store the resolved function back for future calls
          window.html2canvas = fn;
          resolve(fn);
        } else {
          console.error('html2canvas-pro loaded but not a function:', window.html2canvas);
          reject(new Error('html2canvas-pro loaded but function not found'));
        }
      };

      script.onerror = () => reject(new Error('Failed to load html2canvas-pro. Check if cdn.jsdelivr.net is blocked.'));
      document.head.appendChild(script);
    });
  }

  // Capture screenshot
  async function captureScreenshot() {
    const html2canvas = await loadHtml2Canvas();

    const captureCanvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      scale: 1, // Use 1x scale to keep image size manageable
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
    textAnnotations = [];
    colorPickerOpen = false;
    comment = '';
    submitted = false;
    const overlay = document.querySelector('.bc-modal-overlay');
    if (overlay) overlay.remove();
    updateButton(); // Restore button to normal state
  }

  // Drawing helpers
  function drawArrow(ctx, from, to) {
    const headLength = 16;
    const headWidth = 10;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);

    // Calculate the point where the line meets the arrowhead base
    const arrowBase = {
      x: to.x - headLength * Math.cos(angle),
      y: to.y - headLength * Math.sin(angle)
    };

    // Draw the line (stopping at arrowhead base for clean connection)
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(arrowBase.x, arrowBase.y);
    ctx.stroke();

    // Draw filled triangle arrowhead
    const perpAngle = angle + Math.PI / 2;
    const point1 = {
      x: arrowBase.x + headWidth * Math.cos(perpAngle),
      y: arrowBase.y + headWidth * Math.sin(perpAngle)
    };
    const point2 = {
      x: arrowBase.x - headWidth * Math.cos(perpAngle),
      y: arrowBase.y - headWidth * Math.sin(perpAngle)
    };

    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(point1.x, point1.y);
    ctx.lineTo(point2.x, point2.y);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
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

  function drawTextOnCanvas(ctx, ta) {
    const padding = 8;
    const lineHeight = 18;
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';

    // Use stored dimensions or calculate from text
    const boxWidth = ta.width || 120;
    const boxHeight = ta.height || 50;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(ta.x, ta.y, boxWidth, boxHeight);

    // Border
    ctx.strokeStyle = ta.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(ta.x, ta.y, boxWidth, boxHeight);

    // Draw text with word wrap
    ctx.fillStyle = ta.color;
    const maxWidth = boxWidth - padding * 2;
    const lines = ta.text.split('\n');
    let y = ta.y + padding + 12;

    lines.forEach(line => {
      const words = line.split(' ');
      let currentLine = '';

      words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          ctx.fillText(currentLine, ta.x + padding, y);
          currentLine = word;
          y += lineHeight;
        } else {
          currentLine = testLine;
        }
      });

      if (currentLine) {
        ctx.fillText(currentLine, ta.x + padding, y);
        y += lineHeight;
      }
    });
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

  // Update toolbar button states without re-rendering
  function updateToolbarState(overlay) {
    const undoBtn = overlay.querySelector('#bc-undo');
    const clearBtn = overlay.querySelector('#bc-clear');
    const hasContent = annotations.length > 0 || textAnnotations.length > 0;
    if (undoBtn) undoBtn.disabled = !hasContent;
    if (clearBtn) clearBtn.disabled = !hasContent;
  }

  // Submit feedback
  async function submitFeedback() {
    if (!canvas) return;

    // Validate name is provided
    if (!submitterName.trim()) {
      alert('Please enter your name');
      const nameInput = document.querySelector('#bc-name');
      if (nameInput) nameInput.focus();
      return;
    }

    isSubmitting = true;
    const submitBtn = document.querySelector('.bc-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    try {
      // Draw text annotations on canvas before saving
      textAnnotations.forEach(ta => {
        if (ta.text && ta.text.trim()) {
          drawTextOnCanvas(ctx, ta);
        }
      });

      // Use JPEG with 0.8 quality to reduce payload size (PNG can exceed Vercel's 4.5MB limit)
      const imageData = canvas.toDataURL('image/jpeg', 0.8);

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
      // Restore button state on error
      const submitBtn = document.querySelector('.bc-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Feedback';
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
              ${colorPickerOpen ? `
                <div class="bc-color-options">
                  <div class="bc-color-option ${activeColor === '#3b82f6' ? 'active' : ''}" style="background: #3b82f6;" data-color="#3b82f6"></div>
                  <div class="bc-color-option ${activeColor === '#f97316' ? 'active' : ''}" style="background: #f97316;" data-color="#f97316"></div>
                  <div class="bc-color-option ${activeColor === '#ec4899' ? 'active' : ''}" style="background: #ec4899;" data-color="#ec4899"></div>
                  <div class="bc-color-option ${activeColor === '#000000' ? 'active' : ''}" style="background: #000000;" data-color="#000000"></div>
                </div>
              ` : ''}
            </div>
            <div class="bc-divider"></div>
            <button class="bc-action-btn" id="bc-undo" ${annotations.length === 0 && textAnnotations.length === 0 ? 'disabled' : ''}>Undo</button>
            <button class="bc-action-btn" id="bc-clear" ${annotations.length === 0 && textAnnotations.length === 0 ? 'disabled' : ''}>Clear</button>
          </div>
          <input type="text" class="bc-name-input" placeholder="Your name *" id="bc-name" value="${submitterName}" ${inlineUserName || inlineUserEmail ? 'readonly' : ''} required />
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
            <div class="bc-color-option ${activeColor === '#3b82f6' ? 'active' : ''}" style="background: #3b82f6;" data-color="#3b82f6"></div>
            <div class="bc-color-option ${activeColor === '#f97316' ? 'active' : ''}" style="background: #f97316;" data-color="#f97316"></div>
            <div class="bc-color-option ${activeColor === '#ec4899' ? 'active' : ''}" style="background: #ec4899;" data-color="#ec4899"></div>
            <div class="bc-color-option ${activeColor === '#000000' ? 'active' : ''}" style="background: #000000;" data-color="#000000"></div>
          </div>
        `;
        container.insertAdjacentHTML('beforeend', optionsHtml);

        container.querySelectorAll('.bc-color-option').forEach(opt => {
          opt.onclick = (e) => {
            e.stopPropagation();
            activeColor = opt.dataset.color;
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
    };

    overlay.querySelector('#bc-comment').oninput = (e) => {
      comment = e.target.value;
    };

    // Canvas drawing events
    canvas.onmousedown = canvas.ontouchstart = (e) => {
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

        // Drag functionality
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        wrapper.onmousedown = (e) => {
          if (e.target === input || e.target === deleteBtn || e.target === resizeHandle) return;
          isDragging = true;
          dragOffsetX = e.clientX - wrapper.offsetLeft;
          dragOffsetY = e.clientY - wrapper.offsetTop;
          e.preventDefault();
        };

        document.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          const newX = e.clientX - dragOffsetX;
          const newY = e.clientY - dragOffsetY;
          wrapper.style.left = newX + 'px';
          wrapper.style.top = newY + 'px';
          // Update canvas coordinates
          textAnn.x = newX / scaleX;
          textAnn.y = newY / scaleY;
        });

        document.addEventListener('mouseup', () => {
          isDragging = false;
        });

        // Resize functionality
        let isResizing = false;
        let startWidth = 0;
        let startHeight = 0;
        let startX = 0;
        let startY = 0;

        resizeHandle.onmousedown = (e) => {
          isResizing = true;
          startWidth = input.offsetWidth;
          startHeight = input.offsetHeight;
          startX = e.clientX;
          startY = e.clientY;
          e.preventDefault();
          e.stopPropagation();
        };

        document.addEventListener('mousemove', (e) => {
          if (!isResizing) return;
          const newWidth = Math.max(100, startWidth + (e.clientX - startX));
          const newHeight = Math.max(40, startHeight + (e.clientY - startY));
          input.style.width = newWidth + 'px';
          input.style.height = newHeight + 'px';
          // Store dimensions for canvas drawing
          textAnn.width = newWidth / scaleX;
          textAnn.height = newHeight / scaleY;
        });

        document.addEventListener('mouseup', () => {
          isResizing = false;
        });

        return;
      }

      isDrawing = true;
      currentAnnotation = { type: activeTool, points: [point], color: activeColor, timestamp: Date.now() };
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
      updateToolbarState(overlay);
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
