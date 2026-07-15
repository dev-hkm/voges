import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import LandingPage from './LandingPage.jsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.jsx';
import './styles.css';
import './landing.css';

// Realtime banking must never run stale application code. Remove registrations
// left by previous PWA builds before booting the current bundle.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => {});
}

const isApplicationRoute = window.location.pathname === '/app' || window.location.pathname.startsWith('/app/');
const RootView = isApplicationRoute ? App : LandingPage;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <RootView />
    </AppErrorBoundary>
  </React.StrictMode>,
);
