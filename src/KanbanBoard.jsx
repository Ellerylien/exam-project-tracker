import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import confetti from 'canvas-confetti';
import ProjectDetailModal from './ProjectDetailModal';

const COLUMNS = ['排隊區', '出題中', '修改題目', '待老師回覆', '製作錄音稿與學生卷', '待音檔送件', '結案'];

function getDaysLeftText(deadline) {
  if (!deadline) return '未設定期限';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(deadline); target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '今天截稿';
  if (diffDays > 0) return `${diffDays} 天後`;
  return `逾期 ${Math.abs(diffDays)} 天`;
}

export default function KanbanBoard({ refreshKey, onCopyProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
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
  const handleDragEnd = (e) => { e.currentTarget.style.opacity = '1'; stopAutoScroll(); };
  const handleBoardDragOver = (e) => {
    e.preventDefault(); if (!boardRef.current) return;
    const { left, width } = boardRef.current.getBoundingClientRect();
    const mouseXRel = e.clientX - left;
    if (mouseXRel > width - 50) startAutoScroll(10); else if (mouseXRel < 50) startAutoScroll(-10); else stopAutoScroll();
  };
  const startAutoScroll = (speed) => { if (scrollIntervalRef.current) stopAutoScroll(); scrollIntervalRef.current = setInterval(() => { if (boardRef.current) boardRef.current.scrollLeft += speed; }, 16); };
  const stopAutoScroll = () => { if (scrollIntervalRef.current) { clearInterval(scrollIntervalRef.current); scrollIntervalRef.current = null; } };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault(); stopAutoScroll(); 
    const projectId = e.dataTransfer.getData('projectId');
    if (!projectId) return;
    setProjects(projects.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
    if (newStatus === '結案') confetti();
    try { await supabase.from('projects').update({ status: newStatus }).eq('id', projectId); } catch (error) { fetchProjects(); }
  };

  if (loading) return <div className="p-10 text-[#938A82] text-sm font-medium">載入中...</div>;

  return (
    <div className="p-4 md:p-8 font-sans h-full flex flex-col bg-[#F7F5F0]">
      <div className="mb-5 md:mb-6 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-[#4A4542]">全專案進度</h1>
      </div>

      <div ref={boardRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} onDragOver={handleBoardDragOver}
        className="flex gap-4 md:gap-6 overflow-x-auto pb-6 cursor-grab active:cursor-grabbing flex-1 hide-scrollbar" 
      >
        {COLUMNS.map((columnName) => {
          const columnProjects = projects.filter((p) => p.status === columnName);
          return (
            <div key={columnName} className="bg-[#F0EEE6]/80 border border-[#EBE6DF] rounded-xl p-3 md:p-4 min-w-[280px] md:min-w-[320px] flex flex-col h-fit max-h-[calc(100vh-140px)] md:max-h-[75vh]" onDragOver={e=>e.preventDefault()} onDrop={(e) => handleDrop(e, columnName)}>
              <div className="flex justify-between items-center mb-4 px-1 shrink-0">
                {/* 🔥 調整：將欄位標題放大 */}
                <h2 className="text-sm md:text-[15px] font-bold text-[#8A847C] tracking-wide">{columnName}</h2>
                <span className="text-[11px] font-bold text-[#938A82] px-2.5 py-0.5 border border-[#EBE6DF] bg-white/50 rounded-full">{columnProjects.length}</span>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1 min-h-[150px] md:min-h-[200px] pb-2">
                {columnProjects.length === 0 ? (
                  <div className="border border-dashed border-[#D1C9BE] rounded-lg p-6 text-center text-[#B3AAA0] text-sm font-medium">暫無專案</div>
                ) : (
                  columnProjects.map((project) => (
                    <div key={project.id} draggable="true" onClick={() => setSelectedProject(project)} onDragStart={(e) => handleDragStart(e, project.id)} onDragEnd={handleDragEnd} 
                      className={`relative p-4 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.02)] border cursor-pointer hover:border-[#D1C9BE] transition-all
                        ${project.has_unread ? 'bg-[#FBF3DB] border-[#E9DBB9]/80' : 'bg-white border-[#EBE6DF]'}
                      `}
                    >
                      {project.has_unread && (
                        <span className="absolute top-3 right-3 flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span></span>
                      )}
                      <div className="text-[10px] font-bold text-[#938A82] mb-2 uppercase tracking-wide">{getDaysLeftText(project.deadline)}</div>
                      
                      {/* 🔥 調整：專案名稱字體稍微縮小一點點 */}
                      <h3 className="font-bold text-[#4A4542] mb-3 text-[13px] md:text-sm leading-snug">{project.name}</h3>
                      
                      {/* 🔥 調整：移除「業務:」，且將字體稍微放大 */}
                      <div className="flex items-center text-xs text-[#938A82] font-medium border-t border-[#F7F5F0] pt-2.5 mt-1">
                        <span className="truncate">{project.sales_rep || '未指派'}{project.sales_assistant ? ` / ${project.sales_assistant}` : ''}</span>
                      </div>
                    </div>
                  ))
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