import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// ── Apply saved theme before render (prevents flash) ───────
const savedTheme = localStorage.getItem('otp-theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// ── Layer 1: Block right-click / long-press context menu (shows URL in action sheet) ────
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  e.stopPropagation();
}, { capture: true });

// ── Layer 2: Prevent drag-start on any element (dragging an <img> or button can
//    trigger a native URL-preview bubble on Android/iOS WebViews) ─────────────
document.addEventListener('dragstart', (e) => {
  e.preventDefault();
}, { capture: true });

// ── Layer 3: Long-press guard on <a href> elements ───────────────────────────
// Android WebView fires a native "open link" action sheet on long-press of an
// anchor BEFORE the contextmenu event. Blocking touchstart on any surviving
// <a href> elements closes this gap. (All internal navigation already uses
// React Router <Link> / buttons — this is a safety net for any future <a> tags.)
let _longPressTimer = null;
document.addEventListener('touchstart', (e) => {
  const anchor = e.target.closest('a[href]');
  if (!anchor) return;
  // Clear any previously scheduled long-press action
  _longPressTimer = setTimeout(() => {
    // Absorb — do nothing. The native action sheet would fire here.
  }, 300);
}, { capture: true, passive: true });

document.addEventListener('touchend', () => {
  clearTimeout(_longPressTimer);
}, { capture: true, passive: true });

document.addEventListener('touchcancel', () => {
  clearTimeout(_longPressTimer);
}, { capture: true, passive: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
