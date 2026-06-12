import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext } from './toast';

// 輕量 toast 系統：取代 alert()，支援帶動作按鈕（如「復原」）的通知
const DOT_COLOR = {
  success: 'bg-success',
  error: 'bg-danger',
  info: 'bg-info',
};

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
    setToasts(ts => ts.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 200);
  }, []);

  const show = useCallback((message, { type = 'info', action, duration } = {}) => {
    const id = nextId++;
    setToasts(ts => [...ts, { id, message, type, action }]);
    // 帶動作按鈕的停留久一點，給使用者反應時間
    timersRef.current.set(id, setTimeout(() => dismiss(id), duration ?? (action ? 6000 : 4000)));
  }, [dismiss]);

  const api = useMemo(() => ({
    show,
    success: (message, opts) => show(message, { ...opts, type: 'success' }),
    error: (message, opts) => show(message, { ...opts, type: 'error' }),
    info: (message, opts) => show(message, { ...opts, type: 'info' }),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="fixed bottom-5 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm bg-card border border-line rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center gap-3 ${
              t.leaving ? 'opacity-0 translate-y-2 transition-all duration-200' : 'animate-fade-slide-up'
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLOR[t.type] || DOT_COLOR.info}`} />
            <span className="flex-1 text-sm text-ink-soft font-medium break-words">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { dismiss(t.id); t.action.onClick(); }}
                className="text-sm font-bold text-accent hover:text-accent-strong shrink-0"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} aria-label="關閉" className="text-ink-faint hover:text-ink-soft shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
