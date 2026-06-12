import { useState, useEffect, useMemo } from 'react';
import ProjectDetailModal from './ProjectDetailModal';
import NewProjectModal from './NewProjectModal';
import { supabase } from './supabaseClient';
import { getDeadlineInfo, isUrgent } from './deadline';
import Skeleton from './Skeleton';

const SALES_REPS = ['Deborah', 'Mark', 'Richard'];

export default function SalesDashboard({ currentUser, searchTerm, refreshKey, onCopyProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [copyData, setCopyData] = useState(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const [selectedSales, setSelectedSales] = useState(
    currentUser?.role?.toLowerCase() === 'sales' ? currentUser.name : 'Deborah'
  );

  const fetchProjectsBySales = async (salesRep) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('sales_rep', salesRep)
        .or(`name.ilike.%${searchTerm}%,teacher_name.ilike.%${searchTerm}%,scope.ilike.%${searchTerm}%`)
        .order('deadline', { ascending: true }); 

      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectsBySales(selectedSales);
  }, [selectedSales, refreshKey, searchTerm]);

  const stats = useMemo(() => {
    return {
      unfinished: projects.filter(p => p.status !== '結案').length,
      waiting: projects.filter(p => p.status === '待老師回覆').length,
      urgent: projects.filter(p => isUrgent(p.deadline, p.status)).length,
    };
  }, [projects]);

  if (loading && refreshKey === 0) return (
    <div className="flex-1 flex flex-col p-4 md:p-8 space-y-6 md:space-y-8 bg-paper min-h-screen">
      <div className="flex justify-between items-center border-b border-line/60 pb-5">
        <div>
          <Skeleton className="h-7 w-36 mb-2" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-9 w-44 rounded-md hidden sm:block" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="rounded-xl min-h-[110px]" />
        ))}
      </div>
      <div className="bg-card rounded-xl border border-line overflow-hidden">
        <div className="px-5 py-3.5 border-b border-paper"><Skeleton className="h-3 w-24" /></div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 md:px-5 border-b border-paper last:border-b-0">
            <Skeleton className="h-6 w-[78px]" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
  if (error) return <div className="p-8 text-danger text-sm">錯誤: {error}</div>;

  return (
    // 全域背景改為溫潤的暖石色 bg-paper，微調 Padding 創造呼吸感
    <div className="flex-1 flex flex-col p-4 md:p-8 space-y-6 md:space-y-8 min-w-0 bg-paper min-h-screen text-ink">
      
      {/* 頂部：標題與業務選擇 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-line/60 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink">業務分區進度</h1>
          <p className="text-ink-muted mt-1 text-xs md:text-sm font-normal">案件進度與關鍵指標概覽</p>
        </div>
        
        {/* 仿 Notion 下拉選單：純白底、極細灰框、精緻小字 */}
        <div className="bg-card rounded-md border border-line px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-2.5 w-full sm:w-auto">
          <label htmlFor="sales-select" className="text-ink-muted font-medium text-xs md:text-sm whitespace-nowrap shrink-0">業務選擇 :</label>
          <div className="relative flex-1 sm:w-auto">
            <select
              id="sales-select"
              value={selectedSales}
              onChange={(e) => setSelectedSales(e.target.value)}
              className="appearance-none bg-transparent rounded-md pr-7 pl-1 py-0.5 text-ink font-semibold text-xs md:text-sm w-full focus:outline-none cursor-pointer"
            >
              {SALES_REPS.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-ink-muted">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>
      </div>

      {/* 數據統計卡片：改為 Notion 經典呼叫區塊（Callout）配色，大圓角收斂為 md/xl，輕量無陰影 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 近期死線：極淡粉紅底 */}
        <div className="bg-danger-bg border border-danger-line/30 rounded-xl p-5 flex flex-col justify-between min-h-[110px]">
          <div className="text-danger text-xs font-semibold tracking-wide">近期死線 (3天內)</div>
          <div className="text-3xl font-bold text-danger mt-2 flex items-baseline gap-1">
            {stats.urgent} <span className="text-xs font-normal opacity-80">件</span>
          </div>
        </div>
        
        {/* 待老師回覆：極淡鵝黃底 */}
        <div className="bg-warning-bg border border-warning-line/30 rounded-xl p-5 flex flex-col justify-between min-h-[110px]">
          <div className="text-warning text-xs font-semibold tracking-wide">待老師回覆 (需追蹤)</div>
          <div className="text-3xl font-bold text-warning mt-2 flex items-baseline gap-1">
            {stats.waiting} <span className="text-xs font-normal opacity-80">件</span>
          </div>
        </div>

        {/* 未結案總數：極淡水藍底 */}
        <div className="bg-info-bg border border-info-line/30 rounded-xl p-5 flex flex-col justify-between min-h-[110px]">
          <div className="text-info text-xs font-semibold tracking-wide">未結案總數</div>
          <div className="text-3xl font-bold text-info mt-2 flex items-baseline gap-1">
            {stats.unfinished} <span className="text-xs font-normal opacity-80">件</span>
          </div>
        </div>
      </div>

      {/* 專案進度直列清單：改為平面無框感，靠細線優雅分割 */}
      <div className="bg-card rounded-xl border border-line/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-paper bg-paper/50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">專案進度清單</h2>
        </div>
        
        <div className="flex flex-col">
          {projects.length === 0 ? (
            <div className="p-12 md:p-16 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-paper border border-line flex items-center justify-center">
                <svg className="w-5 h-5 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
              </div>
              <div className="text-ink-muted text-sm font-medium">目前尚無相關專案</div>
              <div className="text-ink-faint text-xs">試試切換業務，或調整搜尋關鍵字</div>
            </div>
          ) : (
            projects.map(project => {
              const deadlineInfo = getDeadlineInfo(project.deadline, project.status);
              
              return (
                <div
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.currentTarget.blur(); setSelectedProject(project); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProject(project); } }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:px-5 md:py-4 border-b border-paper last:border-b-0 hover:bg-paper/60 cursor-pointer transition-colors gap-3 group relative"
                >
                  {/* 極簡精緻未讀標示：淡雅的小藍點 */}
                  {project.has_unread && (
                    <span className="absolute top-5 left-1.5 flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                    </span>
                  )}

                  {/* 左側資訊區：死線狀態標籤 + 專案名稱 */}
                  <div className="flex items-start sm:items-center gap-3 md:gap-4 pl-1 sm:pl-0 min-w-0">
                    <div className={`shrink-0 w-[78px] text-center font-semibold py-0.5 md:py-1 rounded border text-[11px] md:text-xs tracking-wide ${deadlineInfo.color}`}>
                      {deadlineInfo.text}
                    </div>
                    
                    <div className="flex flex-col min-w-0">
                      <div className="font-bold text-ink text-sm md:text-base transition-colors truncate">
                        {project.name}
                      </div>
                      <div className="text-ink-muted text-xs flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          {project.teacher_name || '未填寫'} 老師
                        </span>
                        <span className="text-ink-faint hidden sm:inline">|</span>
                        <span className="truncate">範圍: {project.scope || '無'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 右側：精緻平面的狀態標籤（帶有淡雅的圓點提示） */}
                  <div className="self-end sm:self-auto shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-paper-soft/80 text-ink-soft border border-line/30 whitespace-nowrap
                      ${project.status === '結案' ? 'opacity-50 line-through bg-paper' : ''}
                    `}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0
                        ${project.status === '結案' ? 'bg-line-strong' : 
                          project.status === '待老師回覆' ? 'bg-amber-400' : 
                          project.status === '修改題目' ? 'bg-rose-400' : 'bg-blue-400'}
                      `} />
                      {project.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 核心連動 Modal 機制 */}
      <ProjectDetailModal 
        project={selectedProject} 
        onClose={() => setSelectedProject(null)} 
        onProjectDeleted={() => { 
          setProjects(prev => prev.filter(p => p.id !== selectedProject?.id));
          setSelectedProject(null); 
        }}
        onProjectUpdated={() => { 
          fetchProjectsBySales(selectedSales);
        }}
        onStatusChange={(id, newStatus, hasUnread) => { 
          setProjects(prev => 
            prev.map(p => 
              p.id === id ? { ...p, status: newStatus, has_unread: hasUnread } : p
            )
          );
        }}
        onCopyProject={onCopyProject} 
      />
      
      <NewProjectModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} initialData={copyData} onProjectAdded={() => {}} />
    </div>
  );
}