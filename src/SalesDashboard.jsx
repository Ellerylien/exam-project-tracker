import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import ProjectDetailModal from './ProjectDetailModal';

const SALES_REPS = ['Deborah', 'Mark', 'Richard'];

export default function SalesDashboard({ searchTerm, refreshKey, onCopyProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSales, setSelectedSales] = useState(localStorage.getItem('exam_tracker_sales_rep') || '');

  useEffect(() => {
    fetchProjects();
  }, [refreshKey]);

  async function fetchProjects() {
    try {
      const { data, error } = await supabase.from('projects').select('*').order('deadline', { ascending: true });
      if (error) throw error;
      setProjects(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const handleSalesChange = (e) => {
    const rep = e.target.value;
    setSelectedSales(rep);
    localStorage.setItem('exam_tracker_sales_rep', rep);
  };

  const myProjects = projects.filter(p => {
    if (!selectedSales) return false;
    if (p.sales_rep !== selectedSales) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.teacher_name && p.teacher_name.toLowerCase().includes(term)) ||
        (p.scope && p.scope.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const activeProjects = myProjects.filter(p => p.status !== '結案');
  const actionRequiredProjects = myProjects.filter(p => p.status === '待老師回覆');
  
  const urgentProjects = activeProjects.filter(p => {
    if (!p.deadline) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(p.deadline);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  });

  const getDaysLeftText = (deadline) => {
    if (!deadline) return '未設定';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(deadline); target.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '今天截稿';
    if (diffDays > 0) return `${diffDays} 天後`;
    return `逾期 ${Math.abs(diffDays)} 天`;
  };

  if (loading) return <div className="p-10 text-center text-gray-500">資料載入中...</div>;

  return (
    <div className="p-8 font-sans max-w-7xl mx-auto">
      
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">業務分區進度</h1>
          <p className="text-gray-500 mt-1 text-sm">追蹤您的專屬案件與待辦事項 📊</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-200">
          <span className="text-sm font-bold text-gray-700">業務選擇：</span>
          <select 
            value={selectedSales} 
            onChange={handleSalesChange}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-blue-700"
          >
            <option value="">請選擇名字...</option>
            {SALES_REPS.map(rep => <option key={rep} value={rep}>{rep}</option>)}
          </select>
        </div>
      </div>

      {!selectedSales ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <div className="text-5xl mb-4">👋</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">歡迎使用業務分區進度</h2>
          <p className="text-gray-500">請在右上角選擇您的名字，以載入專屬案件資料。</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-sm">
              <div className="text-blue-100 text-sm font-medium mb-1">未結案總數</div>
              <div className="text-4xl font-bold">{activeProjects.length} <span className="text-lg font-normal opacity-80">件</span></div>
            </div>
            <div className="bg-gradient-to-br from-yellow-400 to-orange-400 rounded-xl p-6 text-white shadow-sm">
              <div className="text-yellow-50 text-sm font-medium mb-1">待老師回覆 (需追蹤)</div>
              <div className="text-4xl font-bold">{actionRequiredProjects.length} <span className="text-lg font-normal opacity-80">件</span></div>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-6 text-white shadow-sm">
              <div className="text-red-100 text-sm font-medium mb-1">近期死線 (3天內)</div>
              <div className="text-4xl font-bold">{urgentProjects.length} <span className="text-lg font-normal opacity-80">件</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">專案進度</h3>
            </div>
            
            <div className="divide-y divide-gray-100">
              {myProjects.length === 0 ? (
                <div className="p-8 text-center text-gray-500">目前沒有負責的專案。</div>
              ) : (
                myProjects.map(project => {
                  const isUrgent = activeProjects.includes(project) && urgentProjects.includes(project);
                  const isActionRequired = project.status === '待老師回覆';
                  const isClosed = project.status === '結案';

                  return (
                    <div 
                      key={project.id} 
                      onClick={() => setSelectedProject(project)}
                      className={`p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors ${isClosed ? 'opacity-60' : ''}`}
                    >
                      <div className={`w-24 shrink-0 text-center px-2 py-1.5 rounded-lg text-xs font-bold
                        ${isClosed ? 'bg-gray-100 text-gray-500' : 
                          isUrgent ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-600'}`}
                      >
                        {isClosed ? '已結案' : getDaysLeftText(project.deadline)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-800 text-base mb-1 truncate flex items-center gap-2">
                          {project.name}
                          {isActionRequired && <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] rounded uppercase font-bold animate-pulse">需追蹤</span>}
                        </div>
                        <div className="flex items-center text-xs text-gray-500 gap-3">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                            {project.teacher_name || '未填寫老師'}
                          </span>
                          <span className="truncate max-w-[200px]">範圍: {project.scope || '無'}</span>
                        </div>
                      </div>

                      {/* === 修改：設定不換行，並放大字體為 text-sm === */}
                      <div className="shrink-0 flex justify-end ml-4">
                        <span className={`text-sm whitespace-nowrap font-medium px-3 py-1.5 rounded-full border
                          ${isClosed ? 'bg-gray-50 border-gray-200 text-gray-500' :
                            isActionRequired ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                            'bg-blue-50 border-blue-100 text-blue-700'}`}
                        >
                          {project.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      <ProjectDetailModal 
        project={selectedProject} 
        onClose={() => setSelectedProject(null)} 
        onStatusChange={() => fetchProjects()} 
        onProjectDeleted={() => { fetchProjects(); setSelectedProject(null); }}
        onProjectUpdated={() => { fetchProjects(); setSelectedProject(null); }}
        onCopyProject={onCopyProject}
      />
    </div>
  );
}