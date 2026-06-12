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

  useEffect(() => {
    fetchProjects();
    return () => stopAutoScroll();
  }, [refreshKey]);

  async function fetchProjects() {
    try {
      const { data, error } = await supabase.from('projects').select('*').order('deadline', { ascending: true });
      if (error) throw error;
      setProjects(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const handleMouseDown = (e) => {
    isDown.current = true;
    startX.current = e.pageX - boardRef.current.offsetLeft;
    scrollLeft.current = boardRef.current.scrollLeft;
  };
  const handleMouseLeave = () => { isDown.current = false; };
  const handleMouseUp = () => { isDown.current = false; };
  const handleMouseMove = (e) => {
    if (!isDown.current) return;
    e.preventDefault();
    const x = e.pageX - boardRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5; 
    boardRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleDragStart = (e, id) => { 
    isDown.current = false; 
    e.dataTransfer.setData('projectId', id); 
    e.currentTarget.style.opacity = '0.4'; 
  };
  const handleDragEnd = (e) => { 
    e.currentTarget.style.opacity = '1'; 
    stopAutoScroll(); 
  };

  const handleBoardDragOver = (e) => {
    e.preventDefault();
    if (!boardRef.current) return;
    const { left, width } = boardRef.current.getBoundingClientRect();
    const mouseXRel = e.clientX - left;
    if (mouseXRel > width - 50) startAutoScroll(10);
    else if (mouseXRel < 50) startAutoScroll(-10);
    else stopAutoScroll();
  };

  const startAutoScroll = (speed) => {
    if (scrollIntervalRef.current) stopAutoScroll();
    scrollIntervalRef.current = setInterval(() => { if (boardRef.current) boardRef.current.scrollLeft += speed; }, 16); 
  };
  const stopAutoScroll = () => { 
    if (scrollIntervalRef.current) { clearInterval(scrollIntervalRef.current); scrollIntervalRef.current = null; } 
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault(); stopAutoScroll(); 
    const projectId = e.dataTransfer.getData('projectId');
    if (!projectId) return;
    
    setProjects(projects.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
    if (newStatus === '結案') confetti();

    try { await supabase.from('projects').update({ status: newStatus }).eq('id', projectId); }
    catch (error) { fetchProjects(); }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">資料載入中...</div>;

  return (
    // RWD 優化：縮小手機版的外層 padding
    <div className="p-4 md:p-8 font-sans h-full flex flex-col">
      <div className="mb-4 md:mb-6 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">全專案進度</h1>
        <p className="text-gray-500 mt-1 text-xs md:text-sm">支援拖曳更新狀態，按住背景可滑動看板，點擊卡片可查看詳情 💬</p>
      </div>

      <div 
        ref={boardRef} 
        onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} onDragOver={handleBoardDragOver} onDrop={stopAutoScroll}
        className="flex gap-4 md:gap-6 overflow-x-auto pb-6 cursor-grab active:cursor-grabbing flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" 
      >
        {COLUMNS.map((columnName) => {
          const columnProjects = projects.filter((p) => p.status === columnName);
          const isClosedColumn = columnName === '結案';

          return (
            // RWD 優化：調整看板寬度 (min-w-[280px])，確保手機版能看到一點邊緣暗示可滑動
            <div key={columnName} className="bg-gray-100 rounded-xl p-3 md:p-4 min-w-[280px] md:min-w-[320px] flex flex-col h-fit max-h-[calc(100vh-160px)] md:max-h-[75vh]" onDragOver={e=>e.preventDefault()} onDrop={(e) => handleDrop(e, columnName)}>
              <div className="flex justify-between items-center mb-3 md:mb-4 px-1 md:px-2 shrink-0">
                <h2 className="font-semibold text-gray-700 pointer-events-none">{columnName}</h2>
                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full pointer-events-none">{columnProjects.length}</span>
              </div>

              <div className="flex flex-col gap-3 md:gap-4 overflow-y-auto pr-1 md:pr-2 flex-1 min-h-[150px] md:min-h-[200px] pb-2">
                {columnProjects.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-400 text-sm flex items-center justify-center h-full pointer-events-none">拖曳卡片至此</div>
                ) : (
                  columnProjects.map((project) => {
                    if (isClosedColumn) {
                      return (
                        <div key={project.id} draggable="true" onClick={() => setSelectedProject(project)} onDragStart={(e) => handleDragStart(e, project.id)} onDragEnd={handleDragEnd} className="bg-white hover:bg-gray-50 p-3 rounded-xl shadow-sm border border-gray-200 cursor-pointer text-xs font-bold text-gray-700 truncate transition-all hover:-translate-y-1 hover:shadow-md" title={project.name}>
                          📁 {project.name}
                        </div>
                      );
                    }

                    return (
                      <div key={project.id} draggable="true" onClick={() => setSelectedProject(project)} onDragStart={(e) => handleDragStart(e, project.id)} onDragEnd={handleDragEnd} 
                        className={`relative p-4 md:p-5 rounded-2xl shadow-sm md:shadow-md border cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all
                          ${project.has_unread ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-100'}
                        `}
                      >
                        {project.has_unread && (
                          <span className="absolute top-3 right-3 md:top-4 md:right-4 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                          </span>
                        )}

                        <div className="text-[11px] md:text-xs text-gray-500 mb-1.5 font-bold">{getDaysLeftText(project.deadline)}</div>
                        <h3 className="font-bold text-gray-800 mb-3 md:mb-4 text-sm md:text-base leading-snug pr-4">{project.name}</h3>
                        <div className="flex items-center text-xs md:text-sm text-gray-600 border-t border-gray-200/60 pt-2.5 md:pt-3 mt-1">
                          <svg className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          <span className="truncate">{project.sales_rep || '未指派'} {project.sales_assistant ? ` / ${project.sales_assistant}` : ''}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
        <div className="min-w-[20px] md:min-w-[40px] shrink-0 pointer-events-none"></div>
      </div>

      <ProjectDetailModal 
        project={selectedProject} 
        onClose={() => setSelectedProject(null)} 
        onStatusChange={(id, newStatus, hasUnread = false) => setProjects(projects.map(p => p.id === id ? { ...p, status: newStatus, has_unread: hasUnread } : p))} 
        onProjectDeleted={() => { fetchProjects(); setSelectedProject(null); }}
        onProjectUpdated={() => { fetchProjects(); setSelectedProject(null); }}
        onCopyProject={onCopyProject} 
      />
    </div>
  );
}