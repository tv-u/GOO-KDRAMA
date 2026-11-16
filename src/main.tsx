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

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('HindiDrama render recovery:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
            <h1 className="text-xl font-bold text-white">kdrama-hindi.pages.dev</h1>
            <p className="text-xs text-slate-400">
              Restoring stream view. Click below to reload the catalog cleanly.
            </p>
            <a
              href="./"
              onClick={e => {
                e.preventDefault();
                this.setState({ hasError: false });
              }}
              className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              Reload Dramas
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root')!;
const initialState = typeof window !== 'undefined' ? window.__INITIAL_STATE__ : undefined;

const appTree = (
  <React.StrictMode>
    <RootErrorBoundary>
      <App
        initialDramas={initialState?.dramas}
        initialCastProfile={initialState?.castProfile}
        origin={initialState?.origin}
      />
    </RootErrorBoundary>
  </React.StrictMode>
);

if (rootElement.hasChildNodes() && !rootElement.innerHTML.includes('<!--SSR_OUTLET-->')) {
  hydrateRoot(rootElement, appTree);
} else {
  createRoot(rootElement).render(appTree);
}
