import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Realtime banking must never run stale application code. Remove registrations
// left by previous PWA builds before booting the current bundle.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
