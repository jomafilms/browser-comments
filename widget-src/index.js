// Entry point. The committed artifact is public/widget.js — a dependency-free
// IIFE bundled from these modules. Edit here, then: npm run build:widget
import { widgetKey } from './env.js';
import { init } from './main.js';

if (!widgetKey) {
  console.error('Feedback Widget: Missing data-key attribute');
} else {
  init();
}
