export type DeviceCategory =
  | 'Chrome'
  | 'Safari'
  | 'Firefox'
  | 'Edge'
  | 'iPhone'
  | 'iPad'
  | 'Android'
  | 'Other';

export const DEVICE_CATEGORIES: DeviceCategory[] = [
  'Chrome',
  'Safari',
  'Firefox',
  'Edge',
  'iPhone',
  'iPad',
  'Android',
  'Other',
];

export function categorizeUA(ua: string | null | undefined): DeviceCategory {
  if (!ua) return 'Other';
  const s = ua.toLowerCase();

  if (s.includes('iphone')) return 'iPhone';
  if (s.includes('ipad')) return 'iPad';
  if (s.includes('android')) return 'Android';

  if (s.includes('edg/') || s.includes('edge/')) return 'Edge';
  if (s.includes('firefox/')) return 'Firefox';
  if (s.includes('chrome/') && !s.includes('chromium/')) return 'Chrome';
  if (s.includes('safari/')) return 'Safari';
  return 'Other';
}

// Best-effort iPhone model guess from logical viewport + DPR.
// Apple hides model info in UA, so we fingerprint by screen dimensions.
// Returns null when ambiguous — callers should let the user pick.
export function guessIPhoneModel(
  width: number,
  height: number,
  dpr: number,
): string | null {
  const w = Math.min(width, height);
  const h = Math.max(width, height);
  const key = `${w}x${h}@${dpr}`;
  const map: Record<string, string> = {
    '402x874@3': 'iPhone 17 Pro / 17 / 16 Pro',
    '440x956@3': 'iPhone 17 Pro Max / 16 Pro Max',
    '393x852@3': 'iPhone 16 / 15 Pro',
    '430x932@3': 'iPhone 16 Plus / 15 Pro Max',
    '390x844@3': 'iPhone 15 / 14 / 13 / 12',
    '428x926@3': 'iPhone 14 Plus / 13 Pro Max / 12 Pro Max',
    '375x812@3': 'iPhone 13 mini / 12 mini / X / XS / 11 Pro',
    '414x896@3': 'iPhone 11 Pro Max / XS Max',
    '414x896@2': 'iPhone 11 / XR',
    '375x667@2': 'iPhone SE (2nd/3rd gen) / 8 / 7 / 6',
    '414x736@3': 'iPhone 8 Plus / 7 Plus / 6 Plus',
    '320x568@2': 'iPhone SE (1st gen) / 5s / 5',
  };
  return map[key] || null;
}

export function guessIPadModel(width: number, height: number): string | null {
  const w = Math.min(width, height);
  const h = Math.max(width, height);
  const key = `${w}x${h}`;
  const map: Record<string, string> = {
    '1024x1366': 'iPad Pro 12.9"',
    '1024x1180': 'iPad Pro 11" / iPad Air',
    '820x1180': 'iPad Air',
    '810x1080': 'iPad (10th gen)',
    '768x1024': 'iPad mini / iPad',
    '744x1133': 'iPad mini (6th gen)',
  };
  return map[key] || null;
}
