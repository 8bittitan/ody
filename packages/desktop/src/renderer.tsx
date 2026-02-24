import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './renderer/globals.css';
import { App } from './renderer/App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Renderer root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
