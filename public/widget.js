/* Feedback widget — GENERATED from widget-src/. Edit there, then run: npm run build:widget */ 'use strict';
"use strict";
(() => {
  // widget-src/env.js
  var currentScript = document.currentScript;
  var widgetKey = currentScript?.getAttribute("data-key") || "";
  var inlinePosition = currentScript?.getAttribute("data-position");
  var inlineButtonText = currentScript?.getAttribute("data-button-text");
  var inlineColor = currentScript?.getAttribute("data-color");
  var inlineTitle = currentScript?.getAttribute("data-title");
  var inlineSubtitle = currentScript?.getAttribute("data-subtitle");
  var inlineUserName = currentScript?.getAttribute("data-user-name");
  var inlineUserEmail = currentScript?.getAttribute("data-user-email");
  var scriptSrc = currentScript?.src || "";
  var API_BASE = scriptSrc ? new URL(scriptSrc).origin : window.location.origin;
  var API_URL = API_BASE + "/api/widget";
  var SETTINGS_URL = API_BASE + "/api/settings";

  // widget-src/utils.js
  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }
  var HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
  function safeColor(color, fallback) {
    return HEX_COLOR_RE.test(String(color)) ? color : fallback;
  }
  var DEFAULT_COLOR = "#2563eb";
  function lsGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function lsSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
    }
  }
  var NAME_KEY = "bc_submitter_name";
  var COLOR_KEY = "bc_annotation_color";
  var ANNOTATION_COLORS = ["#3b82f6", "#f97316", "#ec4899", "#000000"];
  var DEFAULT_ANNOTATION_COLOR = "#f97316";

  // widget-src/settings.js
  var config = {
    buttonText: inlineButtonText || "Feedback",
    buttonPosition: inlinePosition || "bottom-right",
    primaryColor: safeColor(inlineColor, DEFAULT_COLOR),
    modalTitle: inlineTitle || "Send Feedback",
    modalSubtitle: inlineSubtitle || "Draw on the screenshot to highlight issues",
    successMessage: "Your feedback has been submitted!"
  };
  var CACHE_KEY = "bc-settings-" + widgetKey;
  var CACHE_DURATION = 24 * 60 * 60 * 1e3;
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
      successMessage: serverSettings.successMessage || config.successMessage
    };
  }
  async function loadSettings() {
    if (hasAllInlineSettings()) {
      return;
    }
    try {
      const cached = lsGet(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          applySettings(data);
          return;
        }
      }
    } catch (e) {
    }
    try {
      const response = await fetch(SETTINGS_URL + "?key=" + widgetKey);
      if (response.ok) {
        const serverSettings = await response.json();
        applySettings(serverSettings);
        lsSet(CACHE_KEY, JSON.stringify({
          data: serverSettings,
          timestamp: Date.now()
        }));
      }
    } catch (err) {
      console.warn("Feedback Widget: Could not load settings", err);
    }
  }

  // widget-src/theme.js
  function isDarkMode() {
    const html = document.documentElement;
    if (html.classList.contains("dark")) return true;
    if (html.getAttribute("data-theme") === "dark") return true;
    if (html.getAttribute("data-mode") === "dark") return true;
    if (document.body?.classList.contains("dark")) return true;
    const bg = window.getComputedStyle(document.body).backgroundColor;
    if (bg) {
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const luminance = (0.299 * +match[1] + 0.587 * +match[2] + 0.114 * +match[3]) / 255;
        if (luminance < 0.4) return true;
      }
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  }
  function injectStyles() {
    const existing = document.getElementById("bc-widget-styles");
    if (existing) existing.remove();
    const dark = isDarkMode();
    const t = dark ? {
      modalBg: "#1f2937",
      modalBorder: "#374151",
      canvasBg: "#111827",
      textPrimary: "#f3f4f6",
      textSecondary: "#9ca3af",
      inputBg: "#374151",
      inputBorder: "#4b5563",
      toolGroupBg: "#374151",
      toolBtnHover: "#4b5563",
      actionBg: "#374151",
      actionHover: "#4b5563",
      cancelBg: "#374151",
      cancelHover: "#4b5563",
      divider: "#4b5563",
      colorOptBg: "#374151",
      colorOptArrow: "#374151",
      colorOptActiveBorder: "#f3f4f6",
      textAnnotationBg: "rgba(31, 41, 55, 0.95)",
      textWrapperHover: "rgba(255,255,255,0.05)",
      canvasBorder: "#4b5563",
      readonlyBg: "#374151",
      readonlyColor: "#9ca3af",
      colorDotBorder: "#374151"
    } : {
      modalBg: "white",
      modalBorder: "#e5e7eb",
      canvasBg: "#f3f4f6",
      textPrimary: "#1f2937",
      textSecondary: "#6b7280",
      inputBg: "white",
      inputBorder: "#d1d5db",
      toolGroupBg: "#f3f4f6",
      toolBtnHover: "#e5e7eb",
      actionBg: "#e5e7eb",
      actionHover: "#d1d5db",
      cancelBg: "#e5e7eb",
      cancelHover: "#d1d5db",
      divider: "#d1d5db",
      colorOptBg: "white",
      colorOptArrow: "white",
      colorOptActiveBorder: "#1f2937",
      textAnnotationBg: "rgba(255, 255, 255, 0.95)",
      textWrapperHover: "rgba(0,0,0,0.05)",
      canvasBorder: "#d1d5db",
      readonlyBg: "#f3f4f6",
      readonlyColor: "#6b7280",
      colorDotBorder: "white"
    };
    const styles = document.createElement("style");
    styles.id = "bc-widget-styles";
    styles.textContent = `
    .bc-widget-btn {
      position: fixed;
      ${config.buttonPosition.includes("bottom") ? "bottom: 16px;" : "top: 16px;"}
      ${config.buttonPosition.includes("right") ? "right: 16px;" : "left: 16px;"}
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

  // widget-src/device.js
  var DEVICE_CATEGORIES = ["Chrome", "Safari", "Firefox", "Edge", "iPhone", "iPad", "Android", "Other"];
  function categorizeUA(ua) {
    if (!ua) return "Other";
    const s = ua.toLowerCase();
    if (s.includes("iphone")) return "iPhone";
    if (s.includes("ipad")) return "iPad";
    if (s.includes("macintosh") && navigator.maxTouchPoints > 1) return "iPad";
    if (s.includes("android")) return "Android";
    if (s.includes("edg/") || s.includes("edge/")) return "Edge";
    if (s.includes("firefox/")) return "Firefox";
    if (s.includes("chrome/") && !s.includes("chromium/")) return "Chrome";
    if (s.includes("safari/")) return "Safari";
    return "Other";
  }
  function guessDeviceModel(category, w, h, dpr, ua) {
    const join = (a, b) => a && b ? `${a} (${b})` : a || b || "";
    if (category === "iPhone") {
      const sw = Math.min(w, h), sh = Math.max(w, h);
      const map = {
        "402x874@3": "iPhone 17 Pro / 17 / 16 Pro",
        "440x956@3": "iPhone 17 Pro Max / 16 Pro Max",
        "393x852@3": "iPhone 16 / 15 Pro",
        "430x932@3": "iPhone 16 Plus / 15 Pro Max",
        "390x844@3": "iPhone 15 / 14 / 13 / 12",
        "428x926@3": "iPhone 14 Plus / 13 Pro Max",
        "375x812@3": "iPhone 13 mini / 12 mini / X / XS / 11 Pro",
        "414x896@3": "iPhone 11 Pro Max / XS Max",
        "414x896@2": "iPhone 11 / XR",
        "375x667@2": "iPhone SE / 8 / 7 / 6"
      };
      const device = map[`${sw}x${sh}@${dpr}`] || "";
      const iosMatch = ua.match(/OS (\d+(?:_\d+){0,2})/);
      const ios = iosMatch ? `iOS ${iosMatch[1].replace(/_/g, ".")}` : "";
      return join(device, ios);
    }
    if (category === "iPad") {
      const sw = Math.min(w, h), sh = Math.max(w, h);
      const map = {
        "1024x1366": 'iPad Pro 12.9"',
        "1024x1180": 'iPad Pro 11" / Air',
        "820x1180": "iPad Air",
        "810x1080": "iPad (10th gen)",
        "768x1024": "iPad mini / iPad",
        "744x1133": "iPad mini (6th gen)"
      };
      const device = map[`${sw}x${sh}`] || "";
      const iosMatch = ua.match(/OS (\d+(?:_\d+){0,2})/);
      const ios = iosMatch ? `iPadOS ${iosMatch[1].replace(/_/g, ".")}` : "";
      return join(device, ios);
    }
    if (category === "Android") {
      const verMatch = ua.match(/Android (\d+(?:\.\d+)?)/);
      const ver = verMatch ? verMatch[1] : "";
      let model = "";
      const m = ua.match(/Android [^;]+; ([^)]+)\)/);
      if (m) model = m[1].split(" Build")[0].trim();
      const os = ver ? `Android ${ver}` : "";
      return join(model, os);
    }
    if (category === "Safari") {
      const m = ua.match(/Version\/(\d+(?:\.\d+)?)/);
      return m ? `Safari ${m[1]}` : "";
    }
    if (category === "Chrome") {
      const m = ua.match(/Chrome\/(\d+)/);
      return m ? `Chrome ${m[1]}` : "";
    }
    if (category === "Firefox") {
      const m = ua.match(/Firefox\/(\d+(?:\.\d+)?)/);
      return m ? `Firefox ${m[1]}` : "";
    }
    if (category === "Edge") {
      const m = ua.match(/Edg\/(\d+)/);
      return m ? `Edge ${m[1]}` : "";
    }
    return "";
  }
  var detectedUA = navigator.userAgent || "";
  var detectedScreenW = window.screen?.width || window.innerWidth;
  var detectedScreenH = window.screen?.height || window.innerHeight;
  var detectedDPR = Math.round(window.devicePixelRatio || 1);
  var detectedCategory = categorizeUA(detectedUA);
  var detectedModel = guessDeviceModel(detectedCategory, detectedScreenW, detectedScreenH, detectedDPR, detectedUA);

  // widget-src/capture.js
  var H2C_LOCAL_URL = API_BASE + "/vendor/html2canvas-pro.min.js";
  var H2C_CDN_URL = "https://cdn.jsdelivr.net/npm/html2canvas-pro@1.6.4/dist/html2canvas-pro.min.js";
  var H2C_CDN_SRI = "sha256-oixkvWBChchryNMpF7wFLdMHrmGWLtbEmtevTjYjYv0=";
  function loadScript(src, integrity) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      if (integrity) {
        script.integrity = integrity;
        script.crossOrigin = "anonymous";
      }
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(new Error("Failed to load " + src));
      };
      document.head.appendChild(script);
    });
  }
  async function loadHtml2Canvas() {
    let fn = window.html2canvas;
    if (typeof fn === "function") return fn;
    try {
      await loadScript(H2C_LOCAL_URL);
    } catch (e) {
      await loadScript(H2C_CDN_URL, H2C_CDN_SRI);
    }
    fn = window.html2canvas;
    if (fn && typeof fn !== "function" && fn.default) fn = fn.default;
    if (fn && typeof fn !== "function" && fn.html2canvas) fn = fn.html2canvas;
    if (typeof fn !== "function") {
      throw new Error("html2canvas-pro loaded but function not found");
    }
    window.html2canvas = fn;
    return fn;
  }
  function swapMediaForPlaceholders() {
    const swaps = [];
    document.querySelectorAll("iframe, video").forEach((el) => {
      const parent = el.parentElement;
      if (!parent) return;
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);
      const placeholder = document.createElement("div");
      placeholder.setAttribute("data-bc-media-placeholder", "1");
      placeholder.style.cssText = `
      width: ${rect.width}px;
      height: ${rect.height}px;
      display: ${computed.display === "inline" ? "inline-block" : computed.display || "block"};
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
      el.style.display = "none";
      swaps.push({ el, placeholder, prevDisplay });
    });
    return () => {
      swaps.forEach(({ el, placeholder, prevDisplay }) => {
        el.style.display = prevDisplay;
        placeholder.remove();
      });
    };
  }
  async function captureScreenshot() {
    const html2canvas = await loadHtml2Canvas();
    const restoreMedia = swapMediaForPlaceholders();
    const CAPTURE_TIMEOUT_MS = 15e3;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Screenshot capture timed out")), CAPTURE_TIMEOUT_MS);
    });
    try {
      const captureCanvas = await Promise.race([
        html2canvas(document.body, {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          // Use 1x scale to keep image size manageable
          logging: false,
          imageTimeout: 2e3,
          // fail fast on slow images; default 15s blocks capture
          backgroundColor: "#ffffff",
          x: window.scrollX,
          y: window.scrollY,
          width: window.innerWidth,
          height: window.innerHeight,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          onclone: (clonedDoc) => {
            const fontStyle = clonedDoc.createElement("style");
            fontStyle.textContent = "* { font-display: block !important; }";
            clonedDoc.head.appendChild(fontStyle);
            const perfStyle = clonedDoc.createElement("style");
            perfStyle.textContent = "*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }";
            clonedDoc.head.appendChild(perfStyle);
            try {
              const view = clonedDoc.defaultView || window;
              clonedDoc.querySelectorAll("*").forEach((el) => {
                const f = view.getComputedStyle(el).filter;
                if (f && f !== "none" && f.indexOf("blur(") !== -1) {
                  el.style.setProperty("filter", "none", "important");
                }
              });
            } catch (_) {
            }
          }
        }),
        timeoutPromise
      ]);
      return captureCanvas.toDataURL("image/png");
    } finally {
      restoreMedia();
    }
  }

  // widget-src/draw.js
  function drawArrow(ctx2, from, to) {
    const headLength = 16;
    const headWidth = 10;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    const arrowBase = {
      x: to.x - headLength * Math.cos(angle),
      y: to.y - headLength * Math.sin(angle)
    };
    ctx2.beginPath();
    ctx2.moveTo(from.x, from.y);
    ctx2.lineTo(arrowBase.x, arrowBase.y);
    ctx2.stroke();
    const perpAngle = angle + Math.PI / 2;
    const point1 = {
      x: arrowBase.x + headWidth * Math.cos(perpAngle),
      y: arrowBase.y + headWidth * Math.sin(perpAngle)
    };
    const point2 = {
      x: arrowBase.x - headWidth * Math.cos(perpAngle),
      y: arrowBase.y - headWidth * Math.sin(perpAngle)
    };
    ctx2.beginPath();
    ctx2.moveTo(to.x, to.y);
    ctx2.lineTo(point1.x, point1.y);
    ctx2.lineTo(point2.x, point2.y);
    ctx2.closePath();
    ctx2.fillStyle = ctx2.strokeStyle;
    ctx2.fill();
  }
  function drawAnnotation(ctx2, ann) {
    if (ann.points.length < 2) return;
    if (ann.type === "draw") {
      ctx2.beginPath();
      ctx2.moveTo(ann.points[0].x, ann.points[0].y);
      ann.points.forEach((p) => ctx2.lineTo(p.x, p.y));
      ctx2.stroke();
    } else if (ann.type === "arrow") {
      drawArrow(ctx2, ann.points[0], ann.points[ann.points.length - 1]);
    } else if (ann.type === "rectangle") {
      const from = ann.points[0];
      const to = ann.points[ann.points.length - 1];
      ctx2.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
    }
  }
  function drawTextOnCanvas(ctx2, ta) {
    const padding = 8;
    const lineHeight = 18;
    ctx2.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
    const boxWidth = ta.width || 120;
    const boxHeight = ta.height || 50;
    ctx2.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx2.fillRect(ta.x, ta.y, boxWidth, boxHeight);
    ctx2.strokeStyle = ta.color;
    ctx2.lineWidth = 2;
    ctx2.strokeRect(ta.x, ta.y, boxWidth, boxHeight);
    ctx2.fillStyle = ta.color;
    const maxWidth = boxWidth - padding * 2;
    const lines = ta.text.split("\n");
    let y = ta.y + padding + 12;
    lines.forEach((line) => {
      const words = line.split(" ");
      let currentLine = "";
      words.forEach((word) => {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        const metrics = ctx2.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          ctx2.fillText(currentLine, ta.x + padding, y);
          currentLine = word;
          y += lineHeight;
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) {
        ctx2.fillText(currentLine, ta.x + padding, y);
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
      y: (clientY - rect.top) * scaleY
    };
  }

  // widget-src/main.js
  var isOpen = false;
  var isCapturing = false;
  var isSubmitting = false;
  var submitted = false;
  var screenshot = null;
  var canvas = null;
  var ctx = null;
  var activeTool = "rectangle";
  var isDrawing = false;
  var annotations = [];
  var currentAnnotation = null;
  var textAnnotations = [];
  var activeColor = safeColor(lsGet(COLOR_KEY), DEFAULT_ANNOTATION_COLOR);
  var colorPickerOpen = false;
  var comment = "";
  var submitterName = inlineUserName || inlineUserEmail || lsGet(NAME_KEY) || "";
  var deviceCategory = detectedCategory;
  var deviceModel = detectedModel;
  var button = null;
  var preCapturePromise = null;
  var isMinimized = lsGet("bc-widget-minimized") === "true";
  var errorMessage = "";
  var lastTicketRef = "";
  var autoCloseTimer = null;
  var lastDarkMode = null;
  function watchDarkMode() {
    const darkModeObserver = new MutationObserver(() => {
      const dark = isDarkMode();
      if (dark !== lastDarkMode) {
        lastDarkMode = dark;
        injectStyles();
      }
    });
    darkModeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-mode"] });
    if (document.body) {
      darkModeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  }
  function toggleMinimize(e) {
    e.stopPropagation();
    isMinimized = !isMinimized;
    lsSet("bc-widget-minimized", isMinimized ? "true" : "false");
    updateButton();
  }
  function updateButton() {
    injectStyles();
    if (!button) {
      button = document.createElement("button");
      button.className = "bc-widget-btn";
      document.body.appendChild(button);
    }
    if (isMinimized) {
      button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
      button.onclick = toggleMinimize;
      button.style.padding = "10px";
    } else {
      button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bc-main-icon">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="bc-btn-text">${esc(config.buttonText)}</span>
      <span class="bc-minimize-btn" title="Minimize">\u2212</span>
    `;
      button.onclick = (e) => {
        e.stopPropagation();
        openModal();
      };
      const startPreCapture = (e) => {
        if (isCapturing || isOpen) return;
        e.preventDefault();
        preCapturePromise = captureScreenshot().catch(() => null);
      };
      button.onmousedown = startPreCapture;
      let touchStartXY = null;
      button.ontouchstart = (e) => {
        const onMinimize = e.target.closest(".bc-minimize-btn");
        const t = e.touches[0];
        touchStartXY = t ? { x: t.clientX, y: t.clientY } : null;
        if (onMinimize) return;
        if (isCapturing || isOpen) return;
        e.preventDefault();
        preCapturePromise = captureScreenshot().catch(() => null);
      };
      button.ontouchend = (e) => {
        const t = e.changedTouches && e.changedTouches[0];
        if (touchStartXY && t) {
          const dx = t.clientX - touchStartXY.x;
          const dy = t.clientY - touchStartXY.y;
          if (Math.hypot(dx, dy) > 20) {
            touchStartXY = null;
            return;
          }
        }
        touchStartXY = null;
        if (e.target.closest(".bc-minimize-btn")) {
          e.preventDefault();
          toggleMinimize(e);
          return;
        }
        if (isOpen) return;
        e.preventDefault();
        openModal();
      };
      button.style.padding = "10px 16px";
      const minimizeBtn = button.querySelector(".bc-minimize-btn");
      if (minimizeBtn) {
        minimizeBtn.onclick = toggleMinimize;
      }
    }
  }
  async function openModal() {
    if (isCapturing) return;
    isCapturing = true;
    button.disabled = true;
    button.innerHTML = `<span class="bc-spinner"></span><span>Capturing\u2026</span>`;
    try {
      if (preCapturePromise) {
        screenshot = await preCapturePromise;
        preCapturePromise = null;
      }
      if (!screenshot) {
        screenshot = await captureScreenshot();
      }
    } catch (err) {
      console.error("Failed to capture screenshot:", err);
      const canvas2 = document.createElement("canvas");
      canvas2.width = 800;
      canvas2.height = 400;
      const ctx2 = canvas2.getContext("2d");
      ctx2.fillStyle = "#f3f4f6";
      ctx2.fillRect(0, 0, 800, 400);
      ctx2.fillStyle = "#6b7280";
      ctx2.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx2.textAlign = "center";
      ctx2.fillText("Screenshot could not be captured", 400, 180);
      ctx2.fillText("Please describe the issue in your comment", 400, 210);
      ctx2.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx2.fillStyle = "#9ca3af";
      ctx2.fillText("(" + (err.message || "Unknown error") + ")", 400, 250);
      screenshot = canvas2.toDataURL("image/png");
    }
    isOpen = true;
    renderModal();
    document.addEventListener("keydown", onEscapeKey);
    isCapturing = false;
    button.disabled = false;
    updateButton();
  }
  function closeModal(opts) {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    if (opts && opts.clearDraft || submitted) comment = "";
    isOpen = false;
    screenshot = null;
    preCapturePromise = null;
    annotations = [];
    currentAnnotation = null;
    textAnnotations = [];
    colorPickerOpen = false;
    submitted = false;
    errorMessage = "";
    document.removeEventListener("keydown", onEscapeKey);
    const overlay = document.querySelector(".bc-modal-overlay");
    if (overlay) overlay.remove();
    updateButton();
  }
  function onEscapeKey(e) {
    if (e.key !== "Escape" || !isOpen || isSubmitting) return;
    const el = document.activeElement;
    if (el && el.classList && el.classList.contains("bc-text-annotation")) {
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
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      annotations.forEach((ann) => {
        ctx.strokeStyle = ann.color || "#f97316";
        drawAnnotation(ctx, ann);
      });
      if (currentAnnotation) {
        ctx.strokeStyle = currentAnnotation.color || activeColor;
        drawAnnotation(ctx, currentAnnotation);
      }
    };
    img.src = screenshot;
  }
  function updateToolbarState(overlay) {
    const undoBtn = overlay.querySelector("#bc-undo");
    const clearBtn = overlay.querySelector("#bc-clear");
    const hasContent = annotations.length > 0 || textAnnotations.length > 0;
    if (undoBtn) undoBtn.disabled = !hasContent;
    if (clearBtn) clearBtn.disabled = !hasContent;
  }
  function showFormError(message) {
    errorMessage = message || "";
    const el = document.querySelector("#bc-error");
    if (el) {
      el.textContent = errorMessage;
      el.hidden = !errorMessage;
    }
  }
  async function submitFeedback() {
    if (!canvas || isSubmitting) return;
    const nameInput = document.querySelector("#bc-name");
    if (!submitterName.trim()) {
      showFormError("Please enter your name.");
      if (nameInput) {
        nameInput.classList.add("bc-input-error");
        nameInput.focus();
      }
      return;
    }
    if (nameInput) nameInput.classList.remove("bc-input-error");
    showFormError("");
    isSubmitting = true;
    const submitBtn = document.querySelector(".bc-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting...";
    }
    try {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const exportCtx = exportCanvas.getContext("2d");
      exportCtx.drawImage(canvas, 0, 0);
      textAnnotations.forEach((ta) => {
        if (ta.text && ta.text.trim()) {
          drawTextOnCanvas(exportCtx, ta);
        }
      });
      const imageData = exportCanvas.toDataURL("image/jpeg", 0.8);
      const allTextAnnotations = [];
      textAnnotations.forEach((ta) => {
        if (ta.text && ta.text.trim()) {
          allTextAnnotations.push({ text: ta.text, x: ta.x, y: ta.y, color: ta.color });
        }
      });
      if (comment && comment.trim()) {
        allTextAnnotations.push({ text: comment, x: 0, y: 0, color: "#000000" });
      }
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          deviceModel: deviceModel.trim() || null
        })
      });
      let data = null;
      try {
        data = await response.json();
      } catch (e) {
      }
      if (!response.ok) {
        throw new Error(data && data.error || "Failed to submit");
      }
      lsSet(NAME_KEY, submitterName.trim());
      lastTicketRef = data && data.ref || "";
      submitted = true;
      renderModal();
      autoCloseTimer = setTimeout(closeModal, lastTicketRef ? 4e3 : 2e3);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      const isNetworkError = navigator.onLine === false || err instanceof TypeError;
      showFormError(isNetworkError ? "Network error \u2014 your feedback is still here. Check your connection and try again." : err.message || "Failed to submit feedback. Please try again.");
      const submitBtnAfter = document.querySelector(".bc-submit-btn");
      if (submitBtnAfter) {
        submitBtnAfter.disabled = false;
        submitBtnAfter.textContent = "Submit Feedback";
      }
    } finally {
      isSubmitting = false;
    }
  }
  function renderModal() {
    let overlay = document.querySelector(".bc-modal-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "bc-modal-overlay";
      overlay.onclick = (e) => {
        e.stopPropagation();
        if (e.target === overlay) closeModal();
      };
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
          <div class="bc-success-icon">\u2713</div>
          <p class="bc-success-text">${esc(config.successMessage)}</p>
          ${lastTicketRef ? `<p class="bc-success-ref">Your ticket: ${esc(lastTicketRef)}</p>` : ""}
        </div>
      </div>
    `;
      overlay.querySelector(".bc-close-btn").onclick = () => closeModal();
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
            <button class="bc-tool-btn ${activeTool === "draw" ? "active" : ""}" data-tool="draw" title="Freehand">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              </svg>
            </button>
            <button class="bc-tool-btn ${activeTool === "arrow" ? "active" : ""}" data-tool="arrow" title="Arrow">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
            <button class="bc-tool-btn ${activeTool === "rectangle" ? "active" : ""}" data-tool="rectangle" title="Rectangle">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
            </button>
            <button class="bc-tool-btn ${activeTool === "text" ? "active" : ""}" data-tool="text" title="Text">
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
          <button class="bc-action-btn" id="bc-undo" ${annotations.length === 0 && textAnnotations.length === 0 ? "disabled" : ""}>Undo</button>
          <button class="bc-action-btn" id="bc-clear" ${annotations.length === 0 && textAnnotations.length === 0 ? "disabled" : ""}>Clear</button>
        </div>
        <input type="text" class="bc-name-input" placeholder="Your name *" id="bc-name" value="${esc(submitterName)}" ${inlineUserName || inlineUserEmail ? "readonly" : ""} required />
        <div class="bc-device-row">
          <select class="bc-device-select" id="bc-device-category" title="Browser / device">
            ${DEVICE_CATEGORIES.map((c) => `<option value="${c}" ${c === deviceCategory ? "selected" : ""}>${c}</option>`).join("")}
          </select>
          <input type="text" class="bc-device-model" id="bc-device-model" placeholder="Model/version (optional)" value="${esc(deviceModel)}" />
        </div>
        <textarea class="bc-textarea" placeholder="Add a comment (optional)..." rows="2" id="bc-comment">${esc(comment)}</textarea>
        <div class="bc-form-error" id="bc-error" ${errorMessage ? "" : "hidden"}>${esc(errorMessage)}</div>
        <div class="bc-btn-row">
          <button class="bc-cancel-btn">Cancel</button>
          <button class="bc-submit-btn" ${isSubmitting ? "disabled" : ""}>${isSubmitting ? "Submitting..." : "Submit Feedback"}</button>
        </div>
      </div>
    </div>
  `;
    canvas = overlay.querySelector(".bc-canvas");
    ctx = canvas.getContext("2d");
    redrawCanvas();
    overlay.querySelector(".bc-close-btn").onclick = () => closeModal();
    overlay.querySelector(".bc-cancel-btn").onclick = () => closeModal({ clearDraft: true });
    overlay.querySelector(".bc-submit-btn").onclick = submitFeedback;
    overlay.querySelectorAll(".bc-tool-btn").forEach((btn) => {
      btn.onclick = () => {
        activeTool = btn.dataset.tool;
        overlay.querySelectorAll(".bc-tool-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.tool === activeTool);
        });
        if (canvas) {
          canvas.style.cursor = activeTool === "text" ? "text" : "crosshair";
        }
      };
    });
    const colorPicker = overlay.querySelector("#bc-color-picker");
    const colorDot = colorPicker.querySelector(".bc-color-dot");
    colorDot.onclick = (e) => {
      e.stopPropagation();
      colorPickerOpen = !colorPickerOpen;
      renderColorPicker(colorPicker);
    };
    function renderColorPicker(container) {
      const existingOptions = container.querySelector(".bc-color-options");
      if (existingOptions) existingOptions.remove();
      if (colorPickerOpen) {
        const optionsHtml = `
        <div class="bc-color-options">
          ${ANNOTATION_COLORS.map((c) => `<div class="bc-color-option ${activeColor === c ? "active" : ""}" style="background: ${c};" data-color="${c}"></div>`).join("")}
        </div>
      `;
        container.insertAdjacentHTML("beforeend", optionsHtml);
        container.querySelectorAll(".bc-color-option").forEach((opt) => {
          opt.onclick = (e) => {
            e.stopPropagation();
            activeColor = opt.dataset.color;
            lsSet(COLOR_KEY, activeColor);
            colorPickerOpen = false;
            colorDot.style.background = activeColor;
            renderColorPicker(container);
          };
        });
      }
    }
    overlay.addEventListener("click", () => {
      if (colorPickerOpen) {
        colorPickerOpen = false;
        renderColorPicker(colorPicker);
      }
    });
    overlay.querySelector("#bc-undo").onclick = () => {
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
    overlay.querySelector("#bc-clear").onclick = () => {
      textAnnotations.forEach((ta) => {
        if (ta.element) ta.element.remove();
      });
      annotations = [];
      textAnnotations = [];
      redrawCanvas();
      updateToolbarState(overlay);
    };
    overlay.querySelector("#bc-name").oninput = (e) => {
      submitterName = e.target.value;
      if (submitterName.trim()) e.target.classList.remove("bc-input-error");
    };
    overlay.querySelector("#bc-device-category").onchange = (e) => {
      deviceCategory = e.target.value;
    };
    overlay.querySelector("#bc-device-model").oninput = (e) => {
      deviceModel = e.target.value;
    };
    overlay.querySelector("#bc-comment").oninput = (e) => {
      comment = e.target.value;
    };
    const canvasContainerEl = overlay.querySelector(".bc-canvas-container");
    let pinchStartDist = 0;
    let pinchStartWidth = 0;
    const touchDistance = (touches) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };
    canvasContainerEl.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        pinchStartDist = touchDistance(e.touches);
        pinchStartWidth = canvas.getBoundingClientRect().width;
        e.preventDefault();
      }
    }, { passive: false });
    canvasContainerEl.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        const d = touchDistance(e.touches);
        const minW = 80;
        const maxW = canvas.width * 4;
        const newW = Math.max(minW, Math.min(maxW, pinchStartWidth * (d / pinchStartDist)));
        canvas.style.width = newW + "px";
        canvas.style.height = newW / canvas.width * canvas.height + "px";
        canvas.style.maxWidth = "none";
        e.preventDefault();
      }
    }, { passive: false });
    canvasContainerEl.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) pinchStartDist = 0;
    });
    canvas.onmousedown = canvas.ontouchstart = (e) => {
      if (e.touches && e.touches.length > 1) return;
      e.preventDefault();
      const point = getCanvasPoint(e, canvas);
      if (activeTool === "text") {
        const container = overlay.querySelector(".bc-canvas-container");
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        const screenX = point.x * scaleX;
        const screenY = point.y * scaleY;
        const wrapper = document.createElement("div");
        wrapper.className = "bc-text-wrapper";
        wrapper.style.left = screenX + "px";
        wrapper.style.top = screenY + "px";
        const input = document.createElement("textarea");
        input.className = "bc-text-annotation";
        input.style.borderColor = activeColor;
        input.style.color = activeColor;
        input.rows = 2;
        input.placeholder = "Type here...";
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "bc-text-delete";
        deleteBtn.innerHTML = "\xD7";
        const resizeHandle = document.createElement("div");
        resizeHandle.className = "bc-text-resize";
        wrapper.appendChild(input);
        wrapper.appendChild(deleteBtn);
        wrapper.appendChild(resizeHandle);
        container.appendChild(wrapper);
        input.focus();
        const textAnn = { x: point.x, y: point.y, text: "", color: activeColor, timestamp: Date.now(), element: wrapper, width: 100, height: 50 };
        textAnnotations.push(textAnn);
        input.oninput = () => {
          textAnn.text = input.value;
        };
        input.onblur = () => {
          if (!textAnn.text.trim()) {
            wrapper.remove();
            const idx = textAnnotations.indexOf(textAnn);
            if (idx > -1) textAnnotations.splice(idx, 1);
          }
          redrawCanvas();
          updateToolbarState(overlay);
        };
        deleteBtn.onclick = (e2) => {
          e2.stopPropagation();
          wrapper.remove();
          const idx = textAnnotations.indexOf(textAnn);
          if (idx > -1) textAnnotations.splice(idx, 1);
          redrawCanvas();
          updateToolbarState(overlay);
        };
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        const startDrag = (e2) => {
          const target = e2.target || e2.touches && document.elementFromPoint(e2.touches[0].clientX, e2.touches[0].clientY);
          if (target === input || target === deleteBtn || target === resizeHandle) return;
          isDragging = true;
          const cx = e2.touches ? e2.touches[0].clientX : e2.clientX;
          const cy = e2.touches ? e2.touches[0].clientY : e2.clientY;
          dragOffsetX = cx - wrapper.offsetLeft;
          dragOffsetY = cy - wrapper.offsetTop;
          e2.preventDefault();
        };
        wrapper.onmousedown = startDrag;
        wrapper.ontouchstart = startDrag;
        const moveDrag = (e2) => {
          if (!isDragging) return;
          const cx = e2.touches ? e2.touches[0].clientX : e2.clientX;
          const cy = e2.touches ? e2.touches[0].clientY : e2.clientY;
          const newX = cx - dragOffsetX;
          const newY = cy - dragOffsetY;
          wrapper.style.left = newX + "px";
          wrapper.style.top = newY + "px";
          textAnn.x = newX / scaleX;
          textAnn.y = newY / scaleY;
        };
        document.addEventListener("mousemove", moveDrag);
        document.addEventListener("touchmove", moveDrag, { passive: false });
        const endDrag = () => {
          isDragging = false;
        };
        document.addEventListener("mouseup", endDrag);
        document.addEventListener("touchend", endDrag);
        let isResizing = false;
        let startWidth = 0;
        let startHeight = 0;
        let startX = 0;
        let startY = 0;
        const startResize = (e2) => {
          isResizing = true;
          startWidth = input.offsetWidth;
          startHeight = input.offsetHeight;
          startX = e2.touches ? e2.touches[0].clientX : e2.clientX;
          startY = e2.touches ? e2.touches[0].clientY : e2.clientY;
          e2.preventDefault();
          e2.stopPropagation();
        };
        resizeHandle.onmousedown = startResize;
        resizeHandle.ontouchstart = startResize;
        const moveResize = (e2) => {
          if (!isResizing) return;
          const cx = e2.touches ? e2.touches[0].clientX : e2.clientX;
          const cy = e2.touches ? e2.touches[0].clientY : e2.clientY;
          const newWidth = Math.max(100, startWidth + (cx - startX));
          const newHeight = Math.max(40, startHeight + (cy - startY));
          input.style.width = newWidth + "px";
          input.style.height = newHeight + "px";
          textAnn.width = newWidth / scaleX;
          textAnn.height = newHeight / scaleY;
        };
        document.addEventListener("mousemove", moveResize);
        document.addEventListener("touchmove", moveResize, { passive: false });
        const endResize = () => {
          isResizing = false;
        };
        document.addEventListener("mouseup", endResize);
        document.addEventListener("touchend", endResize);
        return;
      }
      isDrawing = true;
      currentAnnotation = { type: activeTool, points: [point], color: activeColor, timestamp: Date.now() };
    };
    canvas.onmousemove = canvas.ontouchmove = (e) => {
      if (!isDrawing || !currentAnnotation) return;
      if (e.touches && e.touches.length > 1) {
        isDrawing = false;
        currentAnnotation = null;
        return;
      }
      e.preventDefault();
      const point = getCanvasPoint(e, canvas);
      if (activeTool === "draw") {
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
  async function init() {
    await loadSettings();
    injectStyles();
    updateButton();
    watchDarkMode();
  }

  // widget-src/index.js
  if (!widgetKey) {
    console.error("Feedback Widget: Missing data-key attribute");
  } else {
    init();
  }
})();
