import { useState } from 'react';
import { slotLabel, examNoText } from './reminders';

const SKIP_KIND_LABEL = {
  skip: '只略過這次',
  end_term: '本學期從這次起不考',
  stop_series: '整個系列停止提醒',
};

const secondaryButton = 'px-3 py-1.5 rounded-md text-xs font-bold text-ink-soft bg-card border border-line hover:bg-paper hover:border-line-strong transition-colors cursor-pointer disabled:opacity-50';
const primaryButton = 'px-3 py-1.5 rounded-md text-xs font-bold text-paper bg-accent hover:bg-accent-strong transition-colors cursor-pointer shadow-sm disabled:opacity-50';
const dangerButton = 'px-3 py-1.5 rounded-md text-xs font-bold text-danger bg-card border border-danger-line/60 hover:bg-danger-bg transition-colors cursor-pointer disabled:opacity-50';
const inputClassName = 'w-full px-3 py-2 bg-card border border-line rounded-md focus:border-ink-faint outline-none text-sm text-ink placeholder:text-ink-faint transition-colors';

const teacherText = (name) => (name ? `${name.replace(/\s*老師$/, '')} 老師` : '');

export default function ReminderList({ reminders, skipped, canEdit, onCreate, onSkip, onDeleteManual, onAddManual, onRestore }) {
  // 一次只展開一列的略過／刪除選項
  const [expandedId, setExpandedId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    try { return await action(); } finally { setBusy(false); }
  };

  // 操作成功後收合選項：復原的提醒 id 與略過前相同，不收合的話會帶著展開狀態回來
  const act = async (action) => {
    if (await run(action)) setExpandedId(null);
  };

  const restore = async (override) => {
    if (await run(() => onRestore(override)) && skipped.length === 1) setShowSkipped(false);
  };

  const submitManual = async (e) => {
    e.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    if (await run(() => onAddManual(name))) {
      setDraftName('');
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-5 py-2.5 border-b border-paper">
        <p className="text-[11px] md:text-xs text-ink-faint">建立申請後，提醒會自動消失</p>
        <div className="flex items-center gap-2">
          {skipped.length > 0 && (
            <button type="button" onClick={() => setShowSkipped(v => !v)} aria-expanded={showSkipped} className={secondaryButton}>
              已略過 ({skipped.length})
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => setIsAdding(v => !v)} aria-expanded={isAdding} className={secondaryButton}>
              ＋ 手動新增
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <form onSubmit={submitManual} className="px-4 md:px-5 py-4 border-b border-paper bg-paper/40 flex flex-col sm:flex-row sm:items-end gap-3 animate-row-enter motion-reduce:animate-none">
          <label className="flex-1 min-w-0">
            <span className="block text-xs font-bold text-ink-muted mb-1.5">考試名稱 <span className="text-danger">*</span></span>
            <input
              autoFocus
              required
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="台南高商115下一年級開學考"
              className={inputClassName}
            />
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setIsAdding(false)} className={secondaryButton}>取消</button>
            <button type="submit" disabled={busy} className={primaryButton}>新增提醒</button>
          </div>
        </form>
      )}

      {showSkipped && skipped.length > 0 && (
        <div className="border-b border-paper bg-paper/40 py-1.5 animate-row-enter motion-reduce:animate-none">
          {skipped.map(o => (
            <div key={o.id} className="flex items-center justify-between gap-3 px-4 md:px-5 py-1.5">
              <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm text-ink-soft truncate">{o.name}</span>
                <span className="text-[11px] text-ink-muted">{SKIP_KIND_LABEL[o.kind]}{o.created_by ? ` · ${o.created_by}` : ''}</span>
              </div>
              {canEdit && (
                <button type="button" disabled={busy} onClick={() => restore(o)} className={`${secondaryButton} shrink-0`}>復原</button>
              )}
            </div>
          ))}
        </div>
      )}

      {reminders.length === 0 ? (
        <div className="p-12 md:p-16 flex flex-col items-center gap-3 text-center animate-row-enter motion-reduce:animate-none">
          <div className="w-12 h-12 rounded-full bg-paper border border-line flex items-center justify-center">
            <svg className="w-5 h-5 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div className="text-ink-muted text-sm font-medium">目前沒有待申請的考試</div>
          <div className="text-ink-faint text-xs">已申請段考的下一次都建好了；推算不出來的考試可以手動新增</div>
        </div>
      ) : (
        reminders.map((reminder, index) => {
          const isExpanded = expandedId === reminder.id;
          const examNo = reminder.slot?.examNo ?? 0;

          return (
            <div
              key={reminder.id}
              style={{ animationDelay: `${Math.min(index, 6) * 26}ms` }}
              className="p-4 md:px-5 md:py-4 border-b border-paper last:border-b-0 animate-row-enter motion-reduce:animate-none"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <div className="font-bold text-ink text-sm md:text-base truncate">{reminder.name}</div>
                  <div className="text-ink-muted text-xs mt-0.5 truncate">
                    {reminder.type === 'auto'
                      ? [`接續 ${slotLabel(reminder.basedOnSlot)}`, teacherText(reminder.basedOn.teacher_name)].filter(Boolean).join(' · ')
                      : `手動新增${reminder.override.created_by ? ` · ${reminder.override.created_by}` : ''}`}
                  </div>
                </div>

                {canEdit && !isExpanded && (
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button type="button" onClick={() => setExpandedId(reminder.id)} className={secondaryButton}>
                      {reminder.type === 'auto' ? '略過' : '刪除'}
                    </button>
                    <button type="button" onClick={() => onCreate(reminder)} className={primaryButton}>建立申請</button>
                  </div>
                )}
              </div>

              {canEdit && isExpanded && (
                <div className="mt-3 flex flex-wrap items-center gap-2 animate-row-enter motion-reduce:animate-none">
                  {reminder.type === 'auto' ? (
                    <>
                      <span className="text-xs text-ink-muted mr-1">略過方式</span>
                      <button type="button" disabled={busy} onClick={() => act(() => onSkip(reminder, 'skip'))} className={secondaryButton}>只略過這一次</button>
                      <button type="button" disabled={busy} onClick={() => act(() => onSkip(reminder, 'end_term'))} className={secondaryButton}>
                        {examNo > 1 ? `本學期只考到第${examNoText(examNo - 1)}次` : '這學期都不考'}
                      </button>
                      <button type="button" disabled={busy} onClick={() => act(() => onSkip(reminder, 'stop_series'))} className={dangerButton}>整個系列停止提醒</button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-ink-muted mr-1">刪除這筆手動提醒？</span>
                      <button type="button" disabled={busy} onClick={() => act(() => onDeleteManual(reminder))} className={dangerButton}>刪除</button>
                    </>
                  )}
                  <button type="button" onClick={() => setExpandedId(null)} className="px-2 py-1.5 text-xs font-bold text-ink-muted hover:text-ink transition-colors cursor-pointer">取消</button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
