import { useEffect } from 'react';

// 取代 window.confirm 的確認視窗，z-index 高於所有 Modal（詳情 z-50、編輯 z-[60]）
export default function ConfirmDialog({ open, title, description, confirmLabel = '確定', danger = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-overlay/40 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="bg-paper-warm rounded-xl shadow-2xl w-full max-w-sm p-6 animate-fade-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-ink mb-2">{title}</h3>
        {description && <p className="text-sm text-ink-soft leading-relaxed mb-6">{description}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-ink-soft bg-card border border-line hover:bg-paper rounded-md font-bold transition-colors">取消</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm text-paper rounded-md font-bold transition-colors shadow-sm ${danger ? 'bg-danger hover:bg-danger-strong' : 'bg-accent hover:bg-accent-strong'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
