import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import confetti from 'canvas-confetti';
import ProjectDetailModal from './ProjectDetailModal';
import { getDeadlineInfo } from './deadline';
import Skeleton from './Skeleton';
import { STATUSES } from './constants';

export default function KanbanBoard({ refreshKey, onCopyProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const boardRef = useRef(null); 
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const scrollIntervalRef = useRef(null);

  useEffect(() => { fetchProjects(); return () => stopAutoScroll(); }, [refreshKey]);

  async function fetchProjects() {
    try {
      const { data, error } = await supabase.from('projects').select('*').order('deadline', { ascending: true });
      if (error) throw error;
      setProjects(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const handleMouseDown = (e) => { isDown.current = true; startX.current = e.pageX - boardRef.current.offsetLeft; scrollLeft.current = boardRef.current.scrollLeft; };
  const handleMouseLeave = () => { isDown.current = false; };
  const handleMouseUp = () => { isDown.current = false; };
  const handleMouseMove = (e) => { if (!isDown.current) return; e.preventDefault(); const x = e.pageX - boardRef.current.offsetLeft; const walk = (x - startX.current) * 1.5; boardRef.current.scrollLeft = scrollLeft.current - walk; };
  const handleDragStart = (e, id) => { isDown.current = false; e.dataTransfer.setData('projectId', id); e.currentTarget.style.opacity = '0.4'; };
  const handleDragEnd = (e) => { e.currentTarget.style.opacity = '1'; stopAutoScroll(); setDragOverColumn(null); };
  const handleBoardDragOver = (e) => {
    e.preventDefault(); if (!boardRef.current) return;
    const { left, width } = boardRef.current.getBoundingClientRect();
    const mouseXRel = e.clientX - left;
    if (mouseXRel > width - 50) startAutoScroll(10); else if (mouseXRel < 50) startAutoScroll(-10); else stopAutoScroll();
  };
  const startAutoScroll = (speed) => { if (scrollIntervalRef.current) stopAutoScroll(); scrollIntervalRef.current = setInterval(() => { if (boardRef.current) boardRef.current.scrollLeft += speed; }, 16); };
  const stopAutoScroll = () => { if (scrollIntervalRef.current) { clearInterval(scrollIntervalRef.current); scrollIntervalRef.current = null; } };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault(); stopAutoScroll(); setDragOverColumn(null);
    const projectId = e.dataTransfer.getData('projectId');
    if (!projectId) return;
    setProjects(projects.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
    if (newStatus === '結案') confetti();
    try { await supabase.from('projects').update({ status: newStatus }).eq('id', projectId); } catch (error) { fetchProjects(); }
  };

  if (loading) return (
    <div className="p-4 md:p-8 h-full flex flex-col bg-paper">
      <Skeleton className="h-7 w-32 mb-6 shrink-0" />
      <div className="flex gap-4 md:gap-6 overflow-hidden flex-1">
        {[3, 2, 3, 2].map((cardCount, i) => (
          <div key={i} className="bg-paper-soft/80 border border-line rounded-xl p-3 md:p-4 min-w-[280px] md:min-w-[320px] h-fit">
            <div className="flex justify-between items-center mb-4 px-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-8 rounded-full" />
            </div>
            <div className="flex flex-col gap-3">
              {Array.from({ length: cardCount }).map((_, j) => (
                <div key={j} className="bg-white border border-line rounded-lg p-4">
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

  return (
    <div className="p-4 md:p-8 font-sans h-full flex flex-col bg-paper">
      <div className="mb-5 md:mb-6 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-ink">全專案進度</h1>
      </div>

      <div ref={boardRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} onDragOver={handleBoardDragOver}
        className="flex gap-4 md:gap-6 overflow-x-auto pb-6 cursor-grab active:cursor-grabbing flex-1 hide-scrollbar" 
      >
        {STATUSES.map((columnName) => {
          const columnProjects = projects.filter((p) => p.status === columnName);
          const isDragTarget = dragOverColumn === columnName;
          return (
            <div key={columnName} className={`border rounded-xl p-3 md:p-4 min-w-[280px] md:min-w-[320px] flex flex-col h-fit max-h-[calc(100vh-140px)] md:max-h-[75vh] transition-colors duration-150 ${isDragTarget ? 'bg-line/60 border-line-strong' : 'bg-paper-soft/80 border-line'}`} onDragOver={(e) => { e.preventDefault(); if (dragOverColumn !== columnName) setDragOverColumn(columnName); }} onDrop={(e) => handleDrop(e, columnName)}>
              <div className="flex justify-between items-center mb-4 px-1 shrink-0">
                {/* 🔥 調整：將欄位標題放大 */}
                <h2 className="text-sm md:text-[15px] font-bold text-ink-muted tracking-wide">{columnName}</h2>
                <span className="text-[11px] font-bold text-ink-muted px-2.5 py-0.5 border border-line bg-white/50 rounded-full">{columnProjects.length}</span>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1 min-h-[150px] md:min-h-[200px] pb-2">
                {columnProjects.length === 0 ? (
                  <div className="border border-dashed border-line-strong rounded-lg p-6 text-center text-ink-faint text-sm font-medium">暫無專案</div>
                ) : (
                  columnProjects.map((project) => {
                    const deadlineInfo = getDeadlineInfo(project.deadline, project.status);
                    // 逾期 / 今天 / 3 天內 才上色，其餘維持低調灰字，讓緊急的卡片自己跳出來
                    const isAlert = ['overdue', 'today', 'soon'].includes(deadlineInfo.level);
                    return (
                    <div key={project.id} role="button" tabIndex={0} draggable="true" onClick={(e) => { e.currentTarget.blur(); setSelectedProject(project); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProject(project); } }} onDragStart={(e) => handleDragStart(e, project.id)} onDragEnd={handleDragEnd}
                      className={`relative p-4 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.02)] border cursor-pointer hover:border-line-strong transition-all
                        ${project.has_unread ? 'bg-warning-bg border-warning-line/80' : 'bg-white border-line'}
                      `}
                    >
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
            </div>
          );
        })}
      </div>

      <ProjectDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} onStatusChange={(id, newStatus, hasUnread = false) => setProjects(projects.map(p => p.id === id ? { ...p, status: newStatus, has_unread: hasUnread } : p))} onProjectDeleted={() => { fetchProjects(); setSelectedProject(null); }} onProjectUpdated={() => { fetchProjects(); setSelectedProject(null); }} onCopyProject={onCopyProject} />
    </div>
  );
}