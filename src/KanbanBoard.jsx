import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import confetti from 'canvas-confetti';
import ProjectDetailModal from './ProjectDetailModal';
import { getHandoffDeadlineInfo } from './deadline';
import Skeleton from './Skeleton';
import { STATUSES } from './constants';
import { useToast } from './toast';

// child 水平置中時 container 該捲到的位置；兩端的欄位捲不到正中，就停在邊上
function centeredScrollLeft(container, child) {
  const rect = child.getBoundingClientRect();
  const offset = container.scrollLeft + rect.left - container.getBoundingClientRect().left;
  return Math.min(Math.max(offset - (container.clientWidth - rect.width) / 2, 0), container.scrollWidth - container.clientWidth);
}

function scrollToCenter(container, child, behavior) {
  const left = centeredScrollLeft(container, child);
  container.scrollTo({ left, behavior });
  return left;
}

const smoothUnlessReduced = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

// 切到其他分頁再回來時停回上次看的那一欄（只記在這個瀏覽器分頁，重新開網站仍從排隊區開始）
const ACTIVE_COLUMN_KEY = 'kanban_active_column';
function readSavedColumn() {
  try {
    const saved = Number(sessionStorage.getItem(ACTIVE_COLUMN_KEY));
    return Number.isInteger(saved) && saved >= 0 && saved < STATUSES.length ? saved : 0;
  } catch { return 0; }
}

export default function KanbanBoard({ refreshKey, onCopyProject }) {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  // 階段導覽列：目前停在哪一欄（亮起的膠囊），以及跳過去後短暫描邊提示的欄
  const [activeColumn, setActiveColumn] = useState(readSavedColumn);
  const [flashColumn, setFlashColumn] = useState(null);
  // 拖曳卡片時要關掉手機版的逐欄吸附，不然邊緣自動捲動會一直被吸回原欄
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const boardRef = useRef(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const scrollIntervalRef = useRef(null);
  const columnRefs = useRef([]);
  const pillBarRef = useRef(null);
  const pillRefs = useRef([]);
  const spyLockRef = useRef(null);
  const spyFrameRef = useRef(0);
  const flashTimerRef = useRef(null);

  useEffect(() => { fetchProjects(); return () => stopAutoScroll(); }, [refreshKey]);

  useEffect(() => () => {
    clearTimeout(flashTimerRef.current);
    cancelAnimationFrame(spyFrameRef.current);
  }, []);

  // 從導覽列跳欄時暫停 scroll-spy，直到真的捲到目標（最多 1 秒）：
  // 螢幕寬時兩端附近的欄位捲不到正中，途中的位置會被 spy 誤判成隔壁欄。
  // 使用者一碰滾輪、拖曳或觸控就立刻交還給 spy。
  const releaseSpyLock = () => { spyLockRef.current = null; };

  const jumpToColumn = useCallback((index) => {
    const board = boardRef.current;
    const column = columnRefs.current[index];
    if (!board || !column) return;
    setActiveColumn(index);
    const target = scrollToCenter(board, column, smoothUnlessReduced());
    spyLockRef.current = { target, until: performance.now() + 1500 };
    // 焦點跟著移進該欄（同頁錨點的行為）：接著按 Tab 會進到這欄的卡片，
    // 而不是從原本的位置往下走、把看板又捲回去
    column.focus({ preventScroll: true });
    // 欄位已經在畫面內、捲不動時，靠描邊閃一下讓視線找到它
    setFlashColumn(index);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashColumn(null), 700);
  }, []);

  // 資料第一次載完、欄位都排好之後，靜默停回這個分頁上次看的欄（activeColumn 一開始就是它）：
  // 不跑捲動動畫、不閃框、不搶焦點
  useEffect(() => {
    const board = boardRef.current;
    const column = columnRefs.current[readSavedColumn()];
    if (loading || !board || !column) return;
    spyLockRef.current = { target: scrollToCenter(board, column, 'auto'), until: performance.now() + 1500 };
  }, [loading]);

  useEffect(() => {
    try { sessionStorage.setItem(ACTIVE_COLUMN_KEY, String(activeColumn)); } catch { /* 無痕模式等情況存不了就算了 */ }
  }, [activeColumn]);

  // 手動捲動（拖曳、滑鼠滾輪、手機滑動）時反推目前停在哪一欄：
  // 哪一欄「置中時的捲動位置」離現在最近就亮哪一欄，和跳欄用同一套定義才不會互相打架。
  const handleBoardScroll = () => {
    const lock = spyLockRef.current;
    if (lock) {
      if (Math.abs(boardRef.current.scrollLeft - lock.target) < 1 || performance.now() > lock.until) releaseSpyLock();
      return;
    }
    cancelAnimationFrame(spyFrameRef.current);
    spyFrameRef.current = requestAnimationFrame(() => {
      const board = boardRef.current;
      if (!board) return;
      const current = board.scrollLeft;
      const distances = columnRefs.current.map((column) => (column ? Math.abs(centeredScrollLeft(board, column) - current) : Infinity));
      const nearest = Math.min(...distances);
      const candidates = distances.flatMap((distance, i) => (distance - nearest < 1 ? [i] : []));
      // 捲到最左 / 最右時好幾欄都停在同一個位置，改用隨捲動比例從左滑到右的判定線挑一欄，
      // 捲到底時兩端的欄位才亮得起來
      const maxScroll = board.scrollWidth - board.clientWidth;
      const focusX = board.getBoundingClientRect().left + board.clientWidth * (maxScroll > 0 ? current / maxScroll : 0.5);
      const gapToFocus = (i) => { const rect = columnRefs.current[i].getBoundingClientRect(); return Math.abs(rect.left + rect.width / 2 - focusX); };
      const picked = candidates.reduce((best, i) => (gapToFocus(i) < gapToFocus(best) ? i : best));
      // 目前亮的那欄也是答案之一就不換：剛跳到「出題中」卻被判成並列的「排隊區」會很怪
      setActiveColumn((prev) => (candidates.includes(prev) ? prev : picked));
    });
  };

  // 導覽列在手機上放不下會橫向捲動，讓亮起的膠囊保持在視線內
  useEffect(() => {
    const bar = pillBarRef.current;
    const pill = pillRefs.current[activeColumn];
    if (bar && pill && bar.scrollWidth > bar.clientWidth) scrollToCenter(bar, pill, smoothUnlessReduced());
  }, [activeColumn]);

  // 快捷鍵：1–7 跳到對應欄位，← → 逐欄移動。打字中或有對話框、彈出面板開著時不攔截。
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]') || document.querySelector('[role="dialog"]')) return;
      let index;
      if (/^[1-9]$/.test(e.key)) index = Number(e.key) - 1;
      else if (e.key === 'ArrowLeft') index = activeColumn - 1;
      else if (e.key === 'ArrowRight') index = activeColumn + 1;
      else return;
      if (index < 0 || index >= STATUSES.length) return;
      e.preventDefault();
      jumpToColumn(index);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeColumn, jumpToColumn]);

  async function fetchProjects() {
    try {
      // 封存規則：結案且截稿日已超過 30 天的專案不再載入看板，
      // 避免結案欄無限累積（搜尋與業務分區仍查得到所有專案）
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      const { data, error } = await supabase.from('projects').select('*')
        .or(`status.neq.結案,deadline.gte.${cutoffStr}`)
        .order('deadline', { ascending: true });
      if (error) throw error;
      setProjects(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const handleMouseDown = (e) => { releaseSpyLock(); isDown.current = true; startX.current = e.pageX - boardRef.current.offsetLeft; scrollLeft.current = boardRef.current.scrollLeft; };
  const handleMouseLeave = () => { isDown.current = false; };
  const handleMouseUp = () => { isDown.current = false; };
  const handleMouseMove = (e) => { if (!isDown.current) return; e.preventDefault(); const x = e.pageX - boardRef.current.offsetLeft; const walk = (x - startX.current) * 1.5; boardRef.current.scrollLeft = scrollLeft.current - walk; };
  const handleDragStart = (e, id) => { isDown.current = false; setIsDraggingCard(true); e.dataTransfer.setData('projectId', id); e.currentTarget.style.opacity = '0.4'; };
  const handleDragEnd = (e) => { e.currentTarget.style.opacity = '1'; stopAutoScroll(); setDragOverColumn(null); setIsDraggingCard(false); };
  const handleBoardDragOver = (e) => {
    e.preventDefault(); if (!boardRef.current) return;
    const { left, width } = boardRef.current.getBoundingClientRect();
    const mouseXRel = e.clientX - left;
    if (mouseXRel > width - 50) startAutoScroll(10); else if (mouseXRel < 50) startAutoScroll(-10); else stopAutoScroll();
  };
  const startAutoScroll = (speed) => { if (scrollIntervalRef.current) stopAutoScroll(); scrollIntervalRef.current = setInterval(() => { if (boardRef.current) boardRef.current.scrollLeft += speed; }, 16); };
  const stopAutoScroll = () => { if (scrollIntervalRef.current) { clearInterval(scrollIntervalRef.current); scrollIntervalRef.current = null; } };

  const handleDrop = async (e, newStatus) => {
    // 卡片換欄後原本的 DOM 會被卸載、收不到 dragend，所以拖曳狀態要在這裡也收掉
    e.preventDefault(); stopAutoScroll(); setDragOverColumn(null); setIsDraggingCard(false);
    const projectId = e.dataTransfer.getData('projectId');
    if (!projectId) return;
    const project = projects.find(p => p.id === projectId);
    if (!project || project.status === newStatus) return;
    const prevStatus = project.status;
    setProjects(projects.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
    if (newStatus === '結案') confetti();
    try {
      await supabase.from('projects').update({ status: newStatus }).eq('id', projectId);
      toast.success(`「${project.name}」已移至「${newStatus}」`, {
        action: {
          label: '復原',
          onClick: async () => {
            setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: prevStatus } : p));
            await supabase.from('projects').update({ status: prevStatus }).eq('id', projectId);
          },
        },
      });
    } catch {
      toast.error('更新失敗，已還原原本狀態');
      fetchProjects();
    }
  };

  if (loading) return (
    <div className="p-4 md:p-8 h-full flex flex-col bg-paper">
      {/* 和載入後的標題列同結構（含階段導覽列的位置），資料到了看板才不會整片往下跳 */}
      <div className="mb-4 md:mb-6 shrink-0 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-10 w-full max-w-[52rem] rounded-lg" />
      </div>
      <div className="flex gap-4 md:gap-6 overflow-hidden flex-1">
        {[3, 2, 3, 2].map((cardCount, i) => (
          <div key={i} className="bg-paper-soft/80 border border-line rounded-xl p-3 md:p-4 min-w-[280px] md:min-w-[320px] h-fit">
            <div className="flex justify-between items-center mb-4 px-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-8 rounded-full" />
            </div>
            <div className="flex flex-col gap-3">
              {Array.from({ length: cardCount }).map((_, j) => (
                <div key={j} className="bg-card border border-line rounded-lg p-4">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const columns = STATUSES.map((columnName) => {
    const columnProjects = projects.filter((p) => p.status === columnName);
    return { columnName, columnProjects, unreadInColumn: columnProjects.filter((p) => p.has_unread).length };
  });

  return (
    <div className="p-4 md:p-8 font-sans h-full flex flex-col bg-paper">
      <div className="mb-4 md:mb-6 shrink-0 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-ink">全專案進度</h1>

        {/* 階段導覽列：點一下（或按數字鍵）就把該欄捲到正中；捲動看板時跟著亮起目前所在的欄。
            順便當作全局總覽：每階段幾件、哪一階段有未讀回覆，不用橫向捲過去也看得到 */}
        <nav ref={pillBarRef} aria-label="跳到進度階段" className="self-start max-w-full flex gap-1 p-1 bg-paper-soft/80 border border-line rounded-lg overflow-x-auto hide-scrollbar">
          {columns.map(({ columnName, columnProjects, unreadInColumn }, i) => {
            const isActive = activeColumn === i;
            return (
              <button
                key={columnName}
                ref={(el) => { pillRefs.current[i] = el; }}
                type="button"
                onClick={() => jumpToColumn(i)}
                aria-current={isActive ? 'location' : undefined}
                // 報讀完整一句話，不念出裸數字「6 待音檔送件 9」
                aria-label={`${columnName}，${columnProjects.length} 件${unreadInColumn > 0 ? `，${unreadInColumn} 個有未讀回覆` : ''}`}
                aria-keyshortcuts={String(i + 1)}
                title={`跳到「${columnName}」${unreadInColumn > 0 ? `・${unreadInColumn} 個有未讀回覆` : ''}（快捷鍵 ${i + 1}，← → 逐欄移動）`}
                // 有觸控的裝置加高到好點的大小；數字鍵提示只在有滑鼠（通常也有鍵盤）時出現
                className={`shrink-0 inline-flex items-center gap-1.5 h-7 pointer-coarse:h-8 px-2.5 rounded-md border text-xs whitespace-nowrap cursor-pointer transition-colors duration-150 motion-reduce:transition-none
                  ${isActive ? 'bg-card border-line text-ink shadow-[0_1px_3px_rgba(0,0,0,0.03)]' : 'border-transparent text-ink-muted hover:text-ink-soft'}`}
              >
                <kbd className="hidden pointer-fine:inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border border-line bg-card/60 font-sans text-[10px] font-bold leading-none text-ink-muted">{i + 1}</kbd>
                <span className={isActive ? 'font-bold' : 'font-medium'}>{columnName}</span>
                <span className="text-[11px] font-medium tabular-nums text-ink-muted">{columnProjects.length}</span>
                {unreadInColumn > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
              </button>
            );
          })}
        </nav>
      </div>

      <div ref={boardRef} onScroll={handleBoardScroll} onWheel={releaseSpyLock} onTouchStart={releaseSpyLock} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} onDragOver={handleBoardDragOver}
        // 手機上一次滑一欄、停下時剛好置中，和導覽列亮起的那欄永遠對得上。
        // 桌機有滑鼠拖曳捲動，吸附會和它打架，所以只在窄螢幕開
        className={`flex gap-4 md:gap-6 overflow-x-auto pb-6 cursor-grab active:cursor-grabbing flex-1 hide-scrollbar ${isDraggingCard ? '' : 'max-md:snap-x max-md:snap-mandatory'}`}
      >
        {columns.map(({ columnName, columnProjects, unreadInColumn }, i) => {
          const isDragTarget = dragOverColumn === columnName;
          return (
            <div key={columnName} ref={(el) => { columnRefs.current[i] = el; }} role="group" aria-label={columnName} tabIndex={-1} className={`relative outline-none max-md:snap-center border rounded-xl p-3 md:p-4 min-w-[280px] md:min-w-[320px] flex flex-col h-fit max-h-[calc(100vh-140px)] md:max-h-[75vh] transition-colors duration-150 ${isDragTarget ? 'bg-line/60 border-line-strong' : 'bg-paper-soft/80 border-line'}`} onDragOver={(e) => { e.preventDefault(); if (dragOverColumn !== columnName) setDragOverColumn(columnName); }} onDrop={(e) => handleDrop(e, columnName)}>
              {/* 從導覽列跳過來時描邊閃一下：獨立一層只補間 opacity，淡入快、淡出慢 */}
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute -inset-px rounded-xl border-2 border-ink-faint transition-opacity ease-out motion-reduce:transition-none
                  ${flashColumn === i ? 'opacity-100 duration-150' : 'opacity-0 duration-700'}`}
              />
              <div className="flex justify-between items-center mb-4 px-1 shrink-0">
                {/* 🔥 調整：將欄位標題放大 */}
                <h2 className="text-sm md:text-[15px] font-bold text-ink-muted tracking-wide">{columnName}</h2>
                <div className="flex items-center gap-1.5">
                  {/* 欄位捲出畫面時也看得出哪一欄有未讀回覆 */}
                  {unreadInColumn > 0 && (
                    <span className="text-[11px] font-bold text-white bg-blue-500 px-2 py-0.5 rounded-full" title={`${unreadInColumn} 個專案有未讀回覆`}>
                      {unreadInColumn} 未讀
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-ink-muted px-2.5 py-0.5 border border-line bg-card/50 rounded-full">{columnProjects.length}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1 min-h-[150px] md:min-h-[200px] pb-2">
                {columnProjects.length === 0 ? (
                  <div className="border border-dashed border-line-strong rounded-lg p-6 text-center text-ink-faint text-sm font-medium">暫無專案</div>
                ) : (
                  columnProjects.map((project) => {
                    const deadlineInfo = getHandoffDeadlineInfo(project.deadline, project.status);
                    // 逾期 / 今天 / 3 天內 才上色，其餘（含已交件、已結案）維持低調灰字，讓緊急的卡片自己跳出來
                    const isAlert = ['overdue', 'today', 'soon'].includes(deadlineInfo.level);
                    return (
                    <div key={project.id} role="button" tabIndex={0} draggable="true" onClick={(e) => { e.currentTarget.blur(); setSelectedProject(project); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProject(project); } }} onDragStart={(e) => handleDragStart(e, project.id)} onDragEnd={handleDragEnd}
                      className={`group relative p-4 rounded-lg border cursor-pointer
                        transition-[translate,background-color,border-color] duration-[240ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none
                        hover:-translate-y-0.5
                        ${project.has_unread ? 'bg-warning-bg border-warning-line/80' : 'bg-card border-line'}
                      `}
                    >
                      {/* hover 不改描邊，改成把卡片抬起來：兩階陰影各自一層、
                          只補間 opacity 互相交棒（box-shadow 自己過渡會每幀重繪）。
                          與業務分區進度的指標色塊共用同一組 --elevation-* token。 */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-lg shadow-[var(--elevation-rest)]
                          transition-opacity duration-[240ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none
                          opacity-100 group-hover:opacity-0"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-lg shadow-[var(--elevation-hover)]
                          transition-opacity duration-[240ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none
                          opacity-0 group-hover:opacity-100"
                      />
                      {project.has_unread && (
                        <span className="absolute top-3 right-3 flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span></span>
                      )}
                      <div className="mb-2">
                        {isAlert ? (
                          <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border tracking-wide ${deadlineInfo.color}`}>{deadlineInfo.text}</span>
                        ) : (
                          <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wide">{deadlineInfo.text}</span>
                        )}
                      </div>
                      
                      {/* 🔥 調整：專案名稱字體稍微縮小一點點 */}
                      <h3 className="font-bold text-ink mb-3 text-[13px] md:text-sm leading-snug">{project.name}</h3>
                      
                      {/* 🔥 調整：移除「業務:」，且將字體稍微放大 */}
                      <div className="flex items-center text-xs text-ink-muted font-medium border-t border-paper pt-2.5 mt-1">
                        <span className="truncate">{project.sales_rep || '未指派'}{project.sales_assistant ? ` / ${project.sales_assistant}` : ''}</span>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>

              {columnName === '結案' && (
                <div className="text-[11px] text-ink-faint text-center pt-2 shrink-0">僅顯示近期結案，較舊專案請用搜尋查找</div>
              )}
            </div>
          );
        })}
      </div>

      <ProjectDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} onStatusChange={(id, newStatus, hasUnread = false) => setProjects(projects.map(p => p.id === id ? { ...p, status: newStatus, has_unread: hasUnread } : p))} onProjectDeleted={() => { fetchProjects(); setSelectedProject(null); }} onProjectUpdated={() => { fetchProjects(); setSelectedProject(null); }} onCopyProject={onCopyProject} />
    </div>
  );
}