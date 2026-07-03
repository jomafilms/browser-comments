// Escape config/user values before interpolating into innerHTML
function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Colors go into a <style> tag — only allow hex so they can't break out of CSS
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
function safeColor(color, fallback) {
  return HEX_COLOR_RE.test(String(color)) ? color : fallback;
}

const DEFAULT_COLOR = '#2563eb';

// Safe localStorage access — unavailable in some contexts (Safari private
// mode, sandboxed iframes); degrade to in-memory-only behavior
function lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* unavailable or full */ }
}

// Persisted under their own keys, never inside the settings cache — the
// cache expires and gets rewritten, which is how the name used to get lost
const NAME_KEY = 'bc_submitter_name';
const COLOR_KEY = 'bc_annotation_color';

const ANNOTATION_COLORS = ['#3b82f6', '#f97316', '#ec4899', '#000000'];
const DEFAULT_ANNOTATION_COLOR = '#f97316';

export {
  esc, safeColor, lsGet, lsSet,
  DEFAULT_COLOR, NAME_KEY, COLOR_KEY,
  ANNOTATION_COLORS, DEFAULT_ANNOTATION_COLOR,
};
