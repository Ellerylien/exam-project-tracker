import { useState, useEffect, useMemo } from 'react';
import ProjectDetailModal from './ProjectDetailModal';
import NewProjectModal from './NewProjectModal';
import { supabase } from './supabaseClient';

const SALES_REPS = ['Deborah', 'Mark', 'Richard'];

// 完美對應 Notion 風格的低飽和死線標籤顏色
function getDeadlineInfo(deadline, status) {
  if (status === '結案') return { text: '已結案', color: 'bg-stone-100 text-stone-400 border-transparent' };
  if (!deadline) return { text: '未設定期限', color: 'bg-stone-100 text-stone-500 border-transparent' };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(deadline); target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, color: 'bg-[#FAEBEC] text-[#9C3A3C] border-[#E9C4C6]/40' };
  if (diffDays === 0) return { text: '今天截稿', color: 'bg-[#FAEBEC] text-[#9C3A3C] border-[#E9C4C6]/40' };
  if (diffDays <= 3) return { text: `${diffDays} 天後截稿`, color: 'bg-[#FBF3DB] text-[#8F6B1A] border-[#E9DBB9]/40' };
  return { text: `${diffDays} 天後`, color: 'bg-[#EDF3F5] text-[#2B5D72] border-[#D3E3E8]/40' };
}

function isUrgent(deadline, status) {
  if (status === '結案' || !deadline) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(deadline); target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diffDays <= 3;
}

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

  if (loading && refreshKey === 0) return <div className="p-8 text-stone-400 animate-pulse font-medium text-sm">載入中...</div>;
  if (error) return <div className="p-8 text-red-600 text-sm">錯誤: {error}</div>;

  return (
    // 全域背景改為溫潤的暖石色 bg-[#F9F9F8]，微調 Padding 創造呼吸感
    <div className="flex-1 flex flex-col p-4 md:p-8 space-y-6 md:space-y-8 min-w-0 bg-[#F9F9F8] min-h-screen text-[#2F3437]">
      
      {/* 頂部：標題與業務選擇 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-stone-200/60 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-stone-800">業務分區進度</h1>
          <p className="text-stone-400 mt-1 text-xs md:text-sm font-normal">案件進度與關鍵指標概覽</p>
        </div>
        
        {/* 仿 Notion 下拉選單：純白底、極細灰框、精緻小字 */}
        <div className="bg-white rounded-md border border-stone-200 px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-2.5 w-full sm:w-auto">
          <label htmlFor="sales-select" className="text-stone-500 font-medium text-xs md:text-sm whitespace-nowrap shrink-0">業務選擇 :</label>
          <div className="relative flex-1 sm:w-auto">
            <select
              id="sales-select"
              value={selectedSales}
              onChange={(e) => setSelectedSales(e.target.value)}
              className="appearance-none bg-transparent rounded-md pr-7 pl-1 py-0.5 text-stone-800 font-semibold text-xs md:text-sm w-full focus:outline-none cursor-pointer"
            >
              {SALES_REPS.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-stone-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>
      </div>

      {/* 數據統計卡片：改為 Notion 經典呼叫區塊（Callout）配色，大圓角收斂為 md/xl，輕量無陰影 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 近期死線：極淡粉紅底 */}
        <div className="bg-[#FAEBEC] border border-[#E9C4C6]/30 rounded-xl p-5 flex flex-col justify-between min-h-[110px]">
          <div className="text-[#9C3A3C] text-xs font-semibold tracking-wide">近期死線 (3天內)</div>
          <div className="text-3xl font-bold text-[#9C3A3C] mt-2 flex items-baseline gap-1">
            {stats.urgent} <span className="text-xs font-normal opacity-80">件</span>
          </div>
        </div>
        
        {/* 待老師回覆：極淡鵝黃底 */}
        <div className="bg-[#FBF3DB] border border-[#E9DBB9]/30 rounded-xl p-5 flex flex-col justify-between min-h-[110px]">
          <div className="text-[#8F6B1A] text-xs font-semibold tracking-wide">待老師回覆 (需追蹤)</div>
          <div className="text-3xl font-bold text-[#8F6B1A] mt-2 flex items-baseline gap-1">
            {stats.waiting} <span className="text-xs font-normal opacity-80">件</span>
          </div>
        </div>

        {/* 未結案總數：極淡水藍底 */}
        <div className="bg-[#EDF3F5] border border-[#D3E3E8]/30 rounded-xl p-5 flex flex-col justify-between min-h-[110px]">
          <div className="text-[#2B5D72] text-xs font-semibold tracking-wide">未結案總數</div>
          <div className="text-3xl font-bold text-[#2B5D72] mt-2 flex items-baseline gap-1">
            {stats.unfinished} <span className="text-xs font-normal opacity-80">件</span>
          </div>
        </div>
      </div>

      {/* 專案進度直列清單：改為平面無框感，靠細線優雅分割 */}
      <div className="bg-white rounded-xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50/50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">專案進度清單</h2>
        </div>
        
        <div className="flex flex-col">
          {projects.length === 0 ? (
            <div className="p-12 text-center text-stone-400 text-sm font-normal">目前尚無相關專案</div>
          ) : (
            projects.map(project => {
              const deadlineInfo = getDeadlineInfo(project.deadline, project.status);
              
              return (
                <div 
                  key={project.id} 
                  onClick={() => setSelectedProject(project)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:px-5 md:py-4 border-b border-stone-100 last:border-b-0 hover:bg-stone-50/60 cursor-pointer transition-colors gap-3 group relative"
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
                      <div className="font-bold text-stone-700 text-sm md:text-base group-hover:text-stone-900 transition-colors truncate">
                        {project.name}
                      </div>
                      <div className="text-stone-400 text-xs flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          {project.teacher_name || '未填寫'} 老師
                        </span>
                        <span className="text-stone-300 hidden sm:inline">|</span>
                        <span className="truncate">範圍: {project.scope || '無'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 右側：精緻平面的狀態標籤（帶有淡雅的圓點提示） */}
                  <div className="self-end sm:self-auto shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-stone-100/80 text-stone-600 border border-stone-200/30 whitespace-nowrap
                      ${project.status === '結案' ? 'opacity-50 line-through bg-stone-50' : ''}
                    `}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0
                        ${project.status === '結案' ? 'bg-stone-300' : 
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