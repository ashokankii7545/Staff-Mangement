import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// 💡 PWA – installable app. Service worker is registered ONLY in production so
// the dev server never serves a cached shell while you iterate.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[SW] registration failed:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

