// Device detection — runs once on widget load so the form prefills cleanly
const DEVICE_CATEGORIES = ['Chrome', 'Safari', 'Firefox', 'Edge', 'iPhone', 'iPad', 'Android', 'Other'];

function categorizeUA(ua) {
  if (!ua) return 'Other';
  const s = ua.toLowerCase();
  if (s.includes('iphone')) return 'iPhone';
  if (s.includes('ipad')) return 'iPad';
  // iPadOS 13+ reports as Mac — disambiguate via touch points
  if (s.includes('macintosh') && navigator.maxTouchPoints > 1) return 'iPad';
  if (s.includes('android')) return 'Android';
  if (s.includes('edg/') || s.includes('edge/')) return 'Edge';
  if (s.includes('firefox/')) return 'Firefox';
  if (s.includes('chrome/') && !s.includes('chromium/')) return 'Chrome';
  if (s.includes('safari/')) return 'Safari';
  return 'Other';
}

function guessDeviceModel(category, w, h, dpr, ua) {
  const join = (a, b) => (a && b ? `${a} (${b})` : a || b || '');

  if (category === 'iPhone') {
    const sw = Math.min(w, h), sh = Math.max(w, h);
    const map = {
      '402x874@3': 'iPhone 17 Pro / 17 / 16 Pro',
      '440x956@3': 'iPhone 17 Pro Max / 16 Pro Max',
      '393x852@3': 'iPhone 16 / 15 Pro',
      '430x932@3': 'iPhone 16 Plus / 15 Pro Max',
      '390x844@3': 'iPhone 15 / 14 / 13 / 12',
      '428x926@3': 'iPhone 14 Plus / 13 Pro Max',
      '375x812@3': 'iPhone 13 mini / 12 mini / X / XS / 11 Pro',
      '414x896@3': 'iPhone 11 Pro Max / XS Max',
      '414x896@2': 'iPhone 11 / XR',
      '375x667@2': 'iPhone SE / 8 / 7 / 6',
    };
    const device = map[`${sw}x${sh}@${dpr}`] || '';
    const iosMatch = ua.match(/OS (\d+(?:_\d+){0,2})/);
    const ios = iosMatch ? `iOS ${iosMatch[1].replace(/_/g, '.')}` : '';
    return join(device, ios);
  }
  if (category === 'iPad') {
    const sw = Math.min(w, h), sh = Math.max(w, h);
    const map = {
      '1024x1366': 'iPad Pro 12.9"',
      '1024x1180': 'iPad Pro 11" / Air',
      '820x1180': 'iPad Air',
      '810x1080': 'iPad (10th gen)',
      '768x1024': 'iPad mini / iPad',
      '744x1133': 'iPad mini (6th gen)',
    };
    const device = map[`${sw}x${sh}`] || '';
    const iosMatch = ua.match(/OS (\d+(?:_\d+){0,2})/);
    const ios = iosMatch ? `iPadOS ${iosMatch[1].replace(/_/g, '.')}` : '';
    return join(device, ios);
  }
  if (category === 'Android') {
    const verMatch = ua.match(/Android (\d+(?:\.\d+)?)/);
    const ver = verMatch ? verMatch[1] : '';
    // Try to pull device name from "Android 14; Pixel 9 Build/..."
    let model = '';
    const m = ua.match(/Android [^;]+; ([^)]+)\)/);
    if (m) model = m[1].split(' Build')[0].trim();
    const os = ver ? `Android ${ver}` : '';
    return join(model, os);
  }
  if (category === 'Safari') {
    const m = ua.match(/Version\/(\d+(?:\.\d+)?)/);
    return m ? `Safari ${m[1]}` : '';
  }
  if (category === 'Chrome') {
    const m = ua.match(/Chrome\/(\d+)/);
    return m ? `Chrome ${m[1]}` : '';
  }
  if (category === 'Firefox') {
    const m = ua.match(/Firefox\/(\d+(?:\.\d+)?)/);
    return m ? `Firefox ${m[1]}` : '';
  }
  if (category === 'Edge') {
    const m = ua.match(/Edg\/(\d+)/);
    return m ? `Edge ${m[1]}` : '';
  }
  return '';
}

const detectedUA = navigator.userAgent || '';
// Use screen.* (stable device dimensions) for the model lookup. window.inner*
// shrinks by the URL bar in iOS Safari, which breaks every iPhone match.
const detectedScreenW = window.screen?.width || window.innerWidth;
const detectedScreenH = window.screen?.height || window.innerHeight;
const detectedDPR = Math.round(window.devicePixelRatio || 1);
const detectedCategory = categorizeUA(detectedUA);
const detectedModel = guessDeviceModel(detectedCategory, detectedScreenW, detectedScreenH, detectedDPR, detectedUA);

export {
  DEVICE_CATEGORIES,
  detectedUA, detectedScreenW, detectedScreenH,
  detectedCategory, detectedModel,
};
