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

// Auto-detect API base from the script's own URL
const scriptSrc = currentScript?.src || '';
const API_BASE = scriptSrc
  ? new URL(scriptSrc).origin
  : window.location.origin;
const API_URL = API_BASE + '/api/widget';
const SETTINGS_URL = API_BASE + '/api/settings';

export {
  widgetKey,
  inlinePosition, inlineButtonText, inlineColor, inlineTitle, inlineSubtitle,
  inlineUserName, inlineUserEmail,
  API_BASE, API_URL, SETTINGS_URL,
};
