import { useState, useEffect, useMemo } from 'react';
import ProjectDetailModal from './ProjectDetailModal';
import NewProjectModal from './NewProjectModal';
import { supabase } from './supabaseClient';

const SALES_REPS = ['Deborah', 'Mark', 'Richard'];

// 判斷死線狀態與顏色標籤
function getDeadlineInfo(deadline, status) {
  if (status === '結案') return { text: '已結案', color: 'bg-gray-100 text-gray-400' };
  if (!deadline) return { text: '未設定', color: 'bg-gray-100 text-gray-500' };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(deadline); target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, color: 'bg-red-100 text-red-600' };
  if (diffDays === 0) return { text: '今天截稿', color: 'bg-red-100 text-red-600' };
  if (diffDays <= 3) return { text: `${diffDays} 天後`, color: 'bg-orange-100 text-orange-600' };
  return { text: `${diffDays} 天後`, color: 'bg-green-100 text-green-600' };
}

// 判斷是否為近期死線 (3天內)
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
        .order('deadline', { ascending: true }); // 依日期排序

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

  // 計算頂部統計數據
  const stats = useMemo(() => {
    return {
      unfinished: projects.filter(p => p.status !== '結案').length,
      waiting: projects.filter(p => p.status === '待老師回覆').length,
      urgent: projects.filter(p => isUrgent(p.deadline, p.status)).length,
    };
  }, [projects]);

  const filteredSalesReps = SALES_REPS.filter(rep => rep !== 'Ellery');

  if (loading && refreshKey === 0) return <div className="p-8 text-gray-500 animate-pulse">載入中...</div>;
  if (error) return <div className="p-8 text-red-500">錯誤: {error}</div>;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 space-y-6 md:space-y-8 min-w-0 bg-gray-50 min-h-screen" style={{ fontFamily: '"Swei Spring", "Noto Sans TC", sans-serif' }}>
      
      {/* 頂部：標題與業務選擇區 (RWD: 手機板自動上下排列) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">業務分區進度</h1>
          <p className="text-gray-500 mt-1 text-sm">追蹤您的專屬案件與待辦事項 📊</p>
        </div>
        
        <div className="bg-white rounded-xl p-2 md:px-4 md:py-2 shadow-sm border border-gray-200 flex items-center gap-3 w-full md:w-auto">
          <label htmlFor="sales-select" className="text-gray-700 font-bold ml-2 md:ml-0 whitespace-nowrap shrink-0">業務選擇 :</label>
          <div className="relative flex-1 md:w-auto">
            <select
              id="sales-select"
              value={selectedSales}
              onChange={(e) => setSelectedSales(e.target.value)}
              className="appearance-none bg-blue-50 border border-blue-100 rounded-lg px-4 py-1.5 pr-10 text-blue-700 font-bold w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filteredSalesReps.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-blue-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>
      </div>

      {/* 數據統計卡片 (RWD: 手機板1欄，桌機板3欄) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-md flex flex-col justify-center transform transition-transform hover:-translate-y-1">
          <div className="text-blue-100 text-sm font-medium mb-1">未結案總數</div>
          <div className="text-4xl font-black flex items-baseline gap-1">{stats.unfinished} <span className="text-lg font-medium text-blue-200">件</span></div>
        </div>
        
        <div className="bg-amber-500 rounded-2xl p-6 text-white shadow-md flex flex-col justify-center transform transition-transform hover:-translate-y-1">
          <div className="text-amber-100 text-sm font-medium mb-1">待老師回覆 (需追蹤)</div>
          <div className="text-4xl font-black flex items-baseline gap-1">{stats.waiting} <span className="text-lg font-medium text-amber-200">件</span></div>
        </div>

        <div className="bg-rose-600 rounded-2xl p-6 text-white shadow-md flex flex-col justify-center transform transition-transform hover:-translate-y-1">
          <div className="text-rose-100 text-sm font-medium mb-1">近期死線 (3天內)</div>
          <div className="text-4xl font-black flex items-baseline gap-1">{stats.urgent} <span className="text-lg font-medium text-rose-200">件</span></div>
        </div>
      </div>

      {/* 專案進度直列清單 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
          <h2 className="text-lg font-bold text-gray-800">專案進度</h2>
        </div>
        
        <div className="flex flex-col">
          {projects.length === 0 ? (
            <div className="p-10 text-center text-gray-400 border-b border-gray-50">尚無相關專案</div>
          ) : (
            projects.map(project => {
              const deadlineInfo = getDeadlineInfo(project.deadline, project.status);
              
              return (
                <div 
                  key={project.id} 
                  onClick={() => setSelectedProject(project)}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 md:px-6 md:py-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors gap-3 md:gap-4 group relative"
                >
                  {/* RWD: 手機板未讀紅點獨立顯示在左上 */}
                  {project.has_unread && (
                    <span className="absolute top-4 left-2 flex h-2 w-2 md:h-2.5 md:w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 md:h-2.5 md:w-2.5 bg-red-500"></span>
                    </span>
                  )}

                  {/* 左側：日期標籤與專案資訊 */}
                  <div className="flex items-start md:items-center gap-3 md:gap-5 pl-2 md:pl-0">
                    <div className={`shrink-0 w-[70px] md:w-[90px] text-center font-bold py-1 md:py-1.5 rounded-lg text-xs md:text-sm ${deadlineInfo.color}`}>
                      {deadlineInfo.text}
                    </div>
                    
                    <div className="flex flex-col">
                      <div className="font-bold text-gray-800 text-base md:text-lg group-hover:text-blue-600 transition-colors">
                        {project.name}
                      </div>
                      <div className="text-gray-500 text-xs md:text-sm flex flex-wrap gap-2 md:gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          {project.teacher_name || '無'}老師
                        </span>
                        <span>範圍: {project.scope || '無'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 右側：狀態標籤 */}
                  <div className="self-end md:self-auto">
                    <span className={`px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-bold border whitespace-nowrap
                      ${project.status === '結案' ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-blue-50 text-blue-600 border-blue-100'}
                    `}>
                      {project.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ProjectDetailModal 
        project={selectedProject} 
        onClose={() => setSelectedProject(null)} 
        onProjectDeleted={() => { 
          // 刪除時，直接從畫面上的陣列移除該專案
          setProjects(prev => prev.filter(p => p.id !== selectedProject?.id));
          setSelectedProject(null); 
        }}
        onProjectUpdated={() => { 
          // 如果專案內容有修改，重新抓取一次當前業務的資料
          fetchProjectsBySales(selectedSales);
        }}
        onStatusChange={(id, newStatus, hasUnread) => { 
          // 狀態變更時，立即更新畫面上該專案的狀態與紅點標記
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