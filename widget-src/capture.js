import { API_BASE } from './env.js';

// html2canvas-pro sources (supports oklch, lab, lch, oklab colors):
// same-origin copy first (no third-party supply chain, survives ad-blockers),
// CDN fallback for older self-hosted instances that updated widget.js
// without adding public/vendor/
const H2C_LOCAL_URL = API_BASE + '/vendor/html2canvas-pro.min.js';
const H2C_CDN_URL = 'https://cdn.jsdelivr.net/npm/html2canvas-pro@1.6.4/dist/html2canvas-pro.min.js';
// SRI pins the CDN copy to the exact bytes vendored in public/vendor/
// (see public/vendor/README.md — keep all three in sync on version bumps).
// The local same-origin copy is deliberately NOT pinned so self-hosters can
// update it without rebuilding widget.js.
const H2C_CDN_SRI = 'sha256-oixkvWBChchryNMpF7wFLdMHrmGWLtbEmtevTjYjYv0=';

function loadScript(src, integrity) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    if (integrity) {
      script.integrity = integrity;
      script.crossOrigin = 'anonymous';
    }
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error('Failed to load ' + src));
    };
    document.head.appendChild(script);
  });
}

async function loadHtml2Canvas() {
  let fn = window.html2canvas;
  if (typeof fn === 'function') return fn;

  try {
    await loadScript(H2C_LOCAL_URL);
  } catch (e) {
    await loadScript(H2C_CDN_URL, H2C_CDN_SRI);
  }

  fn = window.html2canvas;
  // html2canvas-pro may export as an object wrapping the function
  if (fn && typeof fn !== 'function' && fn.default) fn = fn.default;
  if (fn && typeof fn !== 'function' && fn.html2canvas) fn = fn.html2canvas;
  if (typeof fn !== 'function') {
    throw new Error('html2canvas-pro loaded but function not found');
  }
  window.html2canvas = fn; // cache resolved function for future captures
  return fn;
}

// Swap source-DOM <video>/<iframe> elements for placeholder divs so html2canvas
// never sees them (it can hang during its source-DOM walk on cross-origin
// video frames, before onclone ever fires). Returns a restore() function.
function swapMediaForPlaceholders() {
  const swaps = [];
  document.querySelectorAll('iframe, video').forEach((el) => {
    const parent = el.parentElement;
    if (!parent) return;
    const rect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);
    const placeholder = document.createElement('div');
    placeholder.setAttribute('data-bc-media-placeholder', '1');
    placeholder.style.cssText = `
      width: ${rect.width}px;
      height: ${rect.height}px;
      display: ${computed.display === 'inline' ? 'inline-block' : (computed.display || 'block')};
      background: linear-gradient(135deg, #f0f0f0 25%, #e0e0e0 25%, #e0e0e0 50%, #f0f0f0 50%, #f0f0f0 75%, #e0e0e0 75%);
      background-size: 20px 20px;
      color: #666;
      font-size: 14px;
      text-align: center;
      overflow: hidden;
      vertical-align: ${computed.verticalAlign};
    `;
    placeholder.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;">
        <div style="background: white; padding: 16px 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="font-weight: bold; margin-bottom: 8px;">Embedded Content</div>
          <div style="font-size: 12px; color: #888;">Not captured in screenshot.<br/>Use annotations to describe the issue.</div>
        </div>
      </div>
    `;
    parent.insertBefore(placeholder, el);
    const prevDisplay = el.style.display;
    el.style.display = 'none';
    swaps.push({ el, placeholder, prevDisplay });
  });
  return () => {
    swaps.forEach(({ el, placeholder, prevDisplay }) => {
      el.style.display = prevDisplay;
      placeholder.remove();
    });
  };
}

// Capture screenshot
async function captureScreenshot() {
  const html2canvas = await loadHtml2Canvas();

  // Pre-process: swap videos/iframes in source DOM before html2canvas touches them.
  // Doing this in onclone is too late — html2canvas can hang during its source-DOM
  // walk on cross-origin video frames, before onclone fires.
  const restoreMedia = swapMediaForPlaceholders();

  // Hard timeout so a stuck html2canvas can't dead-spin the widget forever.
  const CAPTURE_TIMEOUT_MS = 15000;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Screenshot capture timed out')), CAPTURE_TIMEOUT_MS);
  });

  try {
    const captureCanvas = await Promise.race([
      html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 1, // Use 1x scale to keep image size manageable
        logging: false,
        imageTimeout: 2000, // fail fast on slow images; default 15s blocks capture
        backgroundColor: '#ffffff',
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        onclone: (clonedDoc) => {
          const fontStyle = clonedDoc.createElement('style');
          fontStyle.textContent = '* { font-display: block !important; }';
          clonedDoc.head.appendChild(fontStyle);
        },
      }),
      timeoutPromise,
    ]);

    return captureCanvas.toDataURL('image/png');
  } finally {
    restoreMedia();
  }
}

export { captureScreenshot };
