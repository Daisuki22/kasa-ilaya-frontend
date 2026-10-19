import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

const failedChunkReloadKey = 'ki-failed-chunk-reload';

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();

  const failedChunk = event.payload?.message || event.message || 'unknown-chunk';
  try {
    if (sessionStorage.getItem(failedChunkReloadKey) === failedChunk) return;
    sessionStorage.setItem(failedChunkReloadKey, failedChunk);
    window.location.reload();
  } catch {
    // Leave the app error boundary visible if the browser blocks session storage.
  }
});

window.__KASA_DEPLOY_VERSION__ = '2026-09-15-white-screen-fix'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
