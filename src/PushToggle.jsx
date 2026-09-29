import { useEffect, useRef, useState } from 'react';
import { useToast } from './toast';
import { isPushSupported, isIos, isStandalone, getSubscription, saveSubscription, subscribe, unsubscribe } from './push';

// 導覽列的「手機通知」按鈕 + 說明面板。
// 每台裝置各自開啟；開啟後使用者負責的案件（業務、業助、製作人員）
// 有新留言或進度變更時，api/notify.js 會送推播到這台裝置。

// 'checking' | 'on' | 'off' | 'denied' | 'ios-install' | 'ios-old' | 'unsupported'
function detectStatus() {
  if (!isPushSupported()) {
    if (isIos()) return isStandalone() ? 'ios-old' : 'ios-install';
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  return 'checking';
}

const MESSAGES = {
  checking: '檢查中…',
  off: '開啟後，你負責的案件有新留言或進度變更時，這台裝置會跳出通知，網頁關著也收得到。手機、電腦要各自開啟一次。',
  on: '這台裝置已開啟通知。你負責的案件有新留言或進度變更時，會通知你。',
  denied: '這個網站的通知被封鎖了。請到瀏覽器的網站設定，把「通知」改成允許，再重新整理頁面。',
  'ios-install': 'iPhone 要先把網站加入主畫面才能收通知：用 Safari 開啟本網站 → 點下方「分享」→「加入主畫面」，之後從主畫面的圖示開啟，再回到這裡開啟通知。',
  'ios-old': 'iPhone 需要 iOS 16.4 以上才支援網頁通知，請先更新系統。',
  unsupported: '這個瀏覽器不支援通知。如果是從 LINE 點連結開啟的，請改用 Chrome 開啟本網站。',
};

const LABELS = {
  on: '手機通知：已開啟',
  off: '開啟手機通知',
  'ios-install': '開啟手機通知',
  denied: '手機通知：已封鎖',
};

export default function PushToggle({ userName }) {
  const toast = useToast();
  const [status, setStatus] = useState(detectStatus);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  // 已訂閱的裝置：每次登入都重新綁定目前的使用者（同一台裝置換人登入時改推給新的人）
  useEffect(() => {
    if (status !== 'checking') return;
    let cancelled = false;
    getSubscription()
      .then(subscription => {
        if (cancelled) return;
        setStatus(subscription ? 'on' : 'off');
        if (subscription) saveSubscription(userName, subscription).catch(() => {});
      })
      .catch(() => { if (!cancelled) setStatus('unsupported'); });
    return () => { cancelled = true; };
  }, [status, userName]);

  // 面板用 fixed 定位並夾在視窗內，做法同 UnreadInbox
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 32);
    const right = Math.min(Math.max(16, window.innerWidth - rect.right), window.innerWidth - 16 - width);
    setPosition({ top: rect.bottom + 8, right, width });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const handleResize = () => setOpen(false);
    document.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  const run = async (action) => {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  };

  const handleEnable = () => run(async () => {
    try {
      const permission = await subscribe(userName);
      if (permission === 'granted') {
        setStatus('on');
        toast.success('已開啟通知，稍後會收到一則測試通知');
      } else if (permission === 'denied') {
        setStatus('denied');
      }
      // 'default'：使用者關掉了詢問視窗，維持原狀
    } catch (err) {
      console.error('[push] 開啟通知失敗', err);
      toast.error('開啟通知失敗，請再試一次');
    }
  });

  const handleTest = () => run(async () => {
    try {
      const subscription = await getSubscription();
      if (!subscription) { setStatus('off'); return; }
      await saveSubscription(userName, subscription, { test: true });
      toast.success('已送出測試通知');
    } catch {
      toast.error('測試通知送出失敗');
    }
  });

  const handleDisable = () => run(async () => {
    try {
      await unsubscribe();
      setStatus('off');
      toast.success('已關閉這台裝置的通知');
    } catch {
      toast.error('關閉通知失敗，請再試一次');
    }
  });

  const label = LABELS[status] ?? '手機通知';
  // 綠點 = 已開啟；琥珀點 = 還沒開，提醒大家開啟
  const dot = status === 'on' ? 'bg-success' : (status === 'off' || status === 'ios-install') ? 'bg-warning' : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        title={label}
        className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors
          ${open ? 'bg-paper text-ink' : 'text-ink-muted hover:text-ink hover:bg-paper'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
        {dot && <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-card ${dot}`} aria-hidden="true" />}
      </button>

      {open && position && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="手機通知"
          style={{ top: position.top, right: position.right, width: position.width }}
          className="fixed z-50 bg-card border border-line rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.10)] overflow-hidden animate-row-enter motion-reduce:animate-none"
        >
          <div className="px-4 py-3 border-b border-paper flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-ink-muted">手機通知</span>
            {status === 'on' && <span className="text-[11px] font-bold text-success">已開啟</span>}
          </div>
          <div className="px-4 py-4 flex flex-col gap-4">
            <p className="text-sm text-ink-soft leading-relaxed">{MESSAGES[status]}</p>
            {status === 'off' && (
              <button type="button" onClick={handleEnable} disabled={busy} className="w-full bg-accent hover:bg-accent-strong text-paper px-4 py-2 rounded-md text-sm font-bold transition-colors disabled:opacity-60">
                {busy ? '處理中…' : '開啟通知'}
              </button>
            )}
            {status === 'on' && (
              <div className="flex gap-2">
                <button type="button" onClick={handleTest} disabled={busy} className="flex-1 bg-paper text-ink-soft px-3 py-2 rounded-md text-sm font-bold border border-line hover:bg-line transition-colors disabled:opacity-60">
                  {busy ? '處理中…' : '傳送測試通知'}
                </button>
                <button type="button" onClick={handleDisable} disabled={busy} className="px-3 py-2 rounded-md text-sm font-bold text-danger hover:bg-danger-bg transition-colors disabled:opacity-60">
                  關閉
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
