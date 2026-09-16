import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

// 未讀回覆的通知清單：導覽列的鈴鐺 + 下拉清單。
// 未讀狀態記在 projects.has_unread（有人留言時設為 true、打開專案詳情時清除），
// 這裡把所有未讀專案連同最新一則留言列出來，點一下直接開啟，不必到看板逐欄找。

function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} 小時前`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / 60 / 24)} 天前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 未讀專案與各自最新的一則留言，最新回覆的排最上面
async function fetchUnread() {
  const { data: projects, error } = await supabase.from('projects').select('*').eq('has_unread', true);
  if (error) throw error;
  if (!projects.length) return [];

  const { data: comments } = await supabase
    .from('comments')
    .select('project_id, author, content, created_at')
    .in('project_id', projects.map(p => p.id))
    .order('created_at', { ascending: false });

  const latest = new Map();
  for (const comment of comments || []) {
    if (!latest.has(comment.project_id)) latest.set(comment.project_id, comment);
  }
  return projects
    .map(project => ({ project, comment: latest.get(project.id) ?? null }))
    .sort((a, b) => (b.comment?.created_at || '').localeCompare(a.comment?.created_at || ''));
}

export default function UnreadInbox({ count, onOpenProject }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null = 載入中
  const [loadError, setLoadError] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const load = async () => {
    try {
      setItems(await fetchUnread());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  };

  // 清單用 fixed 定位並夾在視窗內：手機上鈴鐺不在最右邊，靠右對齊會超出左緣
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 32);
    const right = Math.min(Math.max(16, window.innerWidth - rect.right), window.innerWidth - 16 - width);
    setPosition({ top: rect.bottom + 8, right, width });
    setItems(null);
    setOpen(true);
    load();
  };

  // 開著的時候未讀數變了（有人剛留言、或在別處讀掉一則）就重抓
  const prevCountRef = useRef(count);
  useEffect(() => {
    if (open && prevCountRef.current !== count) load();
    prevCountRef.current = count;
  });

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

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `未讀回覆 ${count} 則，按一下查看` : '未讀回覆'}
        title={count > 0 ? `${count} 個專案有未讀回覆` : '沒有未讀回覆'}
        className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors
          ${open ? 'bg-paper text-ink' : 'text-ink-muted hover:text-ink hover:bg-paper'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[11px] font-bold leading-[18px] text-center">
            {count}
          </span>
        )}
      </button>

      {open && position && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="未讀回覆"
          style={{ top: position.top, right: position.right, width: position.width }}
          className="fixed z-50 bg-card border border-line rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.10)] overflow-hidden animate-row-enter motion-reduce:animate-none"
        >
          <div className="px-4 py-3 border-b border-paper flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-ink-muted">未讀回覆{count > 0 ? ` (${count})` : ''}</span>
            <span className="text-[11px] text-ink-faint">點選即開啟專案</span>
          </div>

          <div className="max-h-[min(440px,70vh)] overflow-y-auto">
            {loadError ? (
              <div className="px-4 py-8 text-center text-sm text-danger">讀取失敗，請再開一次</div>
            ) : items === null ? (
              <div className="px-4 py-8 text-center text-sm text-ink-faint">載入中…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 flex flex-col items-center gap-2 text-center">
                <div className="text-sm font-medium text-ink-muted">沒有未讀回覆</div>
                <div className="text-xs text-ink-faint">有人在專案留言時，會出現在這裡</div>
              </div>
            ) : (
              items.map(({ project, comment }) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => { setOpen(false); onOpenProject(project); }}
                  className="w-full text-left px-4 py-3 border-b border-paper last:border-b-0 hover:bg-paper/60 transition-colors flex gap-3 cursor-pointer"
                >
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink truncate">{project.name}</span>
                    {comment && (
                      <span className="block text-xs text-ink-soft mt-1 line-clamp-2 break-words">
                        <span className="font-bold">{comment.author}</span>：{comment.content}
                      </span>
                    )}
                    <span className="flex items-center gap-2 mt-1.5 text-[11px] text-ink-muted">
                      <span className="px-1.5 py-0.5 rounded bg-paper-soft border border-line/60 whitespace-nowrap">{project.status}</span>
                      <span className="truncate">{[project.sales_rep, project.sales_assistant].filter(Boolean).join(' / ')}</span>
                      {comment && <span className="ml-auto shrink-0">{timeAgo(comment.created_at)}</span>}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
