import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __INITIAL_STATE__?: {
      dramas?: any[];
      castProfile?: any;
      origin?: string;
    };
  }
}

const rootElement = document.getElementById('root')!;
const initialState = typeof window !== 'undefined' ? window.__INITIAL_STATE__ : undefined;

const appTree = (
  <React.StrictMode>
    <App
      initialDramas={initialState?.dramas}
      initialCastProfile={initialState?.castProfile}
      origin={initialState?.origin}
    />
  </React.StrictMode>
);

if (rootElement.hasChildNodes() && !rootElement.innerHTML.includes('<!--SSR_OUTLET-->')) {
  hydrateRoot(rootElement, appTree);
} else {
  createRoot(rootElement).render(appTree);
}
