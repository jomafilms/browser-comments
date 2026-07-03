import { config } from './settings.js';

// Detect if the host app is in dark mode
function isDarkMode() {
  const html = document.documentElement;
  // Check common dark mode indicators on the host app
  if (html.classList.contains('dark')) return true;
  if (html.getAttribute('data-theme') === 'dark') return true;
  if (html.getAttribute('data-mode') === 'dark') return true;
  if (document.body?.classList.contains('dark')) return true;
  // Check computed background color of body
  const bg = window.getComputedStyle(document.body).backgroundColor;
  if (bg) {
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const luminance = (0.299 * +match[1] + 0.587 * +match[2] + 0.114 * +match[3]) / 255;
      if (luminance < 0.4) return true;
    }
  }
  // Fall back to OS preference
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
}

// Inject styles
function injectStyles() {
  const existing = document.getElementById('bc-widget-styles');
  if (existing) existing.remove();

  const dark = isDarkMode();
  // Theme tokens
  const t = dark ? {
    modalBg: '#1f2937',
    modalBorder: '#374151',
    canvasBg: '#111827',
    textPrimary: '#f3f4f6',
    textSecondary: '#9ca3af',
    inputBg: '#374151',
    inputBorder: '#4b5563',
    toolGroupBg: '#374151',
    toolBtnHover: '#4b5563',
    actionBg: '#374151',
    actionHover: '#4b5563',
    cancelBg: '#374151',
    cancelHover: '#4b5563',
    divider: '#4b5563',
    colorOptBg: '#374151',
    colorOptArrow: '#374151',
    colorOptActiveBorder: '#f3f4f6',
    textAnnotationBg: 'rgba(31, 41, 55, 0.95)',
    textWrapperHover: 'rgba(255,255,255,0.05)',
    canvasBorder: '#4b5563',
    readonlyBg: '#374151',
    readonlyColor: '#9ca3af',
    colorDotBorder: '#374151',
  } : {
    modalBg: 'white',
    modalBorder: '#e5e7eb',
    canvasBg: '#f3f4f6',
    textPrimary: '#1f2937',
    textSecondary: '#6b7280',
    inputBg: 'white',
    inputBorder: '#d1d5db',
    toolGroupBg: '#f3f4f6',
    toolBtnHover: '#e5e7eb',
    actionBg: '#e5e7eb',
    actionHover: '#d1d5db',
    cancelBg: '#e5e7eb',
    cancelHover: '#d1d5db',
    divider: '#d1d5db',
    colorOptBg: 'white',
    colorOptArrow: 'white',
    colorOptActiveBorder: '#1f2937',
    textAnnotationBg: 'rgba(255, 255, 255, 0.95)',
    textWrapperHover: 'rgba(0,0,0,0.05)',
    canvasBorder: '#d1d5db',
    readonlyBg: '#f3f4f6',
    readonlyColor: '#6b7280',
    colorDotBorder: 'white',
  };

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
      background: ${t.modalBg};
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
      border-bottom: 1px solid ${t.modalBorder};
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .bc-modal-title {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 18px;
      font-weight: 600;
      color: ${t.textPrimary};
      margin: 0;
    }
    .bc-modal-subtitle {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: ${t.textSecondary};
      margin: 4px 0 0 0;
    }
    .bc-close-btn {
      background: none;
      border: none;
      font-size: 24px;
      color: ${t.textSecondary};
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .bc-close-btn:hover {
      color: ${t.textPrimary};
    }
    .bc-canvas-container {
      flex: 1;
      overflow: auto;
      padding: 16px;
      background: ${t.canvasBg};
      position: relative;
      touch-action: pan-x pan-y; /* native scroll; pinch handled in JS */
    }
    .bc-canvas {
      max-width: 100%;
      height: auto;
      cursor: crosshair;
      border: 1px solid ${t.canvasBorder};
      border-radius: 4px;
      touch-action: none; /* single-finger drawing is JS-driven */
    }
    .bc-toolbar {
      padding: 16px;
      border-top: 1px solid ${t.modalBorder};
    }
    .bc-tool-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      row-gap: 8px;
      column-gap: 16px;
      margin-bottom: 12px;
    }
    .bc-tool-group {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: ${t.toolGroupBg};
      border-radius: 8px;
    }
    .bc-tool-btn {
      padding: 8px;
      border: none;
      background: transparent;
      border-radius: 4px;
      cursor: pointer;
      color: ${t.textSecondary};
    }
    .bc-tool-btn:hover {
      background: ${t.toolBtnHover};
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
      background: ${t.divider};
    }
    .bc-action-btn {
      padding: 6px 12px;
      border: none;
      background: ${t.actionBg};
      color: ${t.textSecondary};
      border-radius: 4px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    }
    .bc-action-btn:hover {
      background: ${t.actionHover};
    }
    .bc-action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .bc-name-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid ${t.inputBorder};
      border-radius: 8px;
      background: ${t.inputBg};
      color: ${t.textPrimary};
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
      background: ${t.readonlyBg};
      color: ${t.readonlyColor};
    }
    .bc-device-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    .bc-device-select, .bc-device-model {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid ${t.inputBorder};
      border-radius: 8px;
      background: ${t.inputBg};
      color: ${t.textPrimary};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-sizing: border-box;
    }
    .bc-device-select:focus, .bc-device-model:focus {
      outline: none;
      border-color: ${config.primaryColor};
      box-shadow: 0 0 0 2px ${config.primaryColor}33;
    }
    .bc-textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid ${t.inputBorder};
      border-radius: 8px;
      background: ${t.inputBg};
      color: ${t.textPrimary};
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
      background: ${t.cancelBg};
      color: ${t.textSecondary};
      border-radius: 8px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    }
    .bc-cancel-btn:hover {
      background: ${t.cancelHover};
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
      color: ${t.textSecondary};
    }
    .bc-success-ref {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: ${t.textPrimary};
      margin-top: 8px;
    }
    .bc-form-error {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #ef4444;
      margin-bottom: 8px;
    }
    .bc-input-error {
      border-color: #ef4444 !important;
    }
    .bc-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white;
      border-radius: 50%;
      animation: bc-spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes bc-spin {
      to { transform: rotate(360deg); }
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
      border: 2px solid ${t.colorDotBorder};
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
      background: ${t.colorOptBg};
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
      border-top-color: ${t.colorOptArrow};
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
      border-color: ${t.colorOptActiveBorder};
    }
    .bc-text-wrapper {
      position: absolute;
      cursor: move;
      padding: 10px;
      border-radius: 8px;
      margin: -10px;
    }
    .bc-text-wrapper:hover {
      background: ${t.textWrapperHover};
    }
    .bc-text-annotation {
      min-width: 100px;
      background: ${t.textAnnotationBg};
      color: ${t.textPrimary};
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
    @media (max-width: 500px) {
      .bc-modal { max-height: 95vh; border-radius: 8px; }
      .bc-modal-header { padding: 12px; }
      .bc-toolbar { padding: 12px; }
      .bc-canvas-container { padding: 8px; }
      .bc-tool-row { column-gap: 8px; }
      .bc-tool-group { padding: 2px; gap: 2px; }
      .bc-tool-btn { padding: 8px; }
      .bc-action-btn { padding: 8px 10px; font-size: 13px; }
      .bc-divider { display: none; }
      .bc-cancel-btn, .bc-submit-btn { padding: 10px 12px; }
    }
  `;
  document.head.appendChild(styles);
}

export { isDarkMode, injectStyles };
