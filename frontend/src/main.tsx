import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Optional: log to the console for support tickets.
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.info('Service worker registered:', registration.scope);
        }
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.warn('Service worker registration failed:', error);
      });
  });
}
