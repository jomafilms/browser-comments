import { widgetKey, SETTINGS_URL, inlinePosition, inlineButtonText, inlineColor, inlineTitle, inlineSubtitle } from './env.js';
import { safeColor, lsGet, lsSet, DEFAULT_COLOR } from './utils.js';

// Default settings
let config = {
  buttonText: inlineButtonText || 'Feedback',
  buttonPosition: inlinePosition || 'bottom-right',
  primaryColor: safeColor(inlineColor, DEFAULT_COLOR),
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
    primaryColor: safeColor(inlineColor || serverSettings.primaryColor || config.primaryColor, DEFAULT_COLOR),
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
    const cached = lsGet(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        applySettings(data);
        return; // Use cached settings, no server call needed
      }
    }
  } catch (e) {
    // parse error, continue to fetch
  }

  // Fetch from server and cache the result
  try {
    const response = await fetch(SETTINGS_URL + '?key=' + widgetKey);
    if (response.ok) {
      const serverSettings = await response.json();
      applySettings(serverSettings);

      // Cache the settings
      lsSet(CACHE_KEY, JSON.stringify({
        data: serverSettings,
        timestamp: Date.now()
      }));
    }
  } catch (err) {
    console.warn('Feedback Widget: Could not load settings', err);
  }
}

export { config, loadSettings };
