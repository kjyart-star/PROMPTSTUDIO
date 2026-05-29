import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const mountFatalError = (error) => {
  const root = document.getElementById('root');
  if (!root) return;

  const message =
    error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);

  root.innerHTML = `
    <div style="min-height: 100vh; display: grid; place-items: center; padding: 24px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;">
      <div style="max-width: 760px; width: 100%; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 18px 18px; background: rgba(17,24,35,0.7); color: rgba(255,255,255,0.92);">
        <div style="font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; font-size: 12px; opacity: 0.7;">App Load Error</div>
        <h1 style="margin: 8px 0 0 0; font-size: 20px;">화면이 비어있어요. 실행 중 오류가 발생했습니다.</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.8; line-height: 1.5;">
          아래 오류 메시지를 확인하고, Chrome 개발자도구(Console)도 같이 확인해 주세요.
        </p>
        <pre style="margin: 12px 0 0 0; white-space: pre-wrap; word-break: break-word; background: rgba(0,0,0,0.35); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">${message}</pre>
      </div>
    </div>
  `;
};

window.addEventListener('error', (event) => {
  // Keep Vite overlay, but also render a readable message when root becomes blank.
  // eslint-disable-next-line no-console
  console.error(event?.error || event?.message);
  mountFatalError(event?.error || event?.message || 'Unknown error');
});

window.addEventListener('unhandledrejection', (event) => {
  // eslint-disable-next-line no-console
  console.error(event?.reason);
  mountFatalError(event?.reason || 'Unhandled rejection');
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error(error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen p-6 text-white">
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-night-800/70 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
              App Load Error
            </div>
            <h1 className="mt-2 font-display text-xl">화면이 비어있어요. 실행 중 오류가 발생했습니다.</h1>
            <p className="mt-3 text-sm text-white/70">
              아래 메시지를 확인하고, Chrome 개발자도구(Console)도 같이 확인해 주세요.
            </p>
            <pre className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/80">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  mountFatalError('Root element #root not found');
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
