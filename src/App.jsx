import { useState, useEffect } from 'react';
import KanbanBoard from './KanbanBoard';
import CalendarView from './CalendarView';
import SalesDashboard from './SalesDashboard'; 
import NewProjectModal from './NewProjectModal';
import ProjectDetailModal from './ProjectDetailModal';
import { supabase } from './supabaseClient';

export default function App() {
  const [currentView, setCurrentView] = useState('kanban'); 
  const [refreshKey, setRefreshKey] = useState(0); 
  
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [copyData, setCopyData] = useState(null); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchSelectedProject, setSearchSelectedProject] = useState(null);

  const handleOpenNew = () => {
    setCopyData(null);
    setIsNewModalOpen(true);
  };

  const handleCopyProject = (project) => {
    setCopyData(project);
    setIsNewModalOpen(true);
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const fetchSearch = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,teacher_name.ilike.%${searchTerm}%,scope.ilike.%${searchTerm}%`)
        .limit(8);

      if (!error && data) setSearchResults(data);
    };

    const timer = setTimeout(() => fetchSearch(), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div 
      className="min-h-screen bg-gray-100 flex flex-col" 
      style={{ fontFamily: '"Swei Spring", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' }}
    >
      <nav className="bg-white shadow-sm border-b border-gray-200 px-8 py-3 flex items-center justify-between z-10 sticky top-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            </div>
            <span className="font-bold text-gray-800 text-lg hidden md:block">考題專案系統</span>
          </div>

          <div className="relative">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="搜尋專案、老師..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all w-[200px] lg:w-[300px] text-sm"
            />
            {searchTerm && searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-lg border border-gray-100 max-h-[350px] overflow-y-auto z-50">
                <div className="p-3 text-xs text-gray-400 font-medium border-b border-gray-50">搜尋結果 ({searchResults.length})</div>
                {searchResults.map(p => (
                  <div key={p.id} onClick={() => { setSearchSelectedProject(p); setSearchTerm(''); }} className="p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                    <div className="font-bold text-gray-800 truncate text-sm">{p.name}</div>
                    <div className="flex justify-between items-center mt-1.5 text-xs text-gray-500">
                      <span>{p.sales_rep}</span>
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setCurrentView('kanban')} className={`px-4 py-1.5 rounded-md text-sm transition-all ${currentView === 'kanban' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 font-normal'}`}>全專案進度</button>
            <button onClick={() => setCurrentView('calendar')} className={`px-4 py-1.5 rounded-md text-sm transition-all ${currentView === 'calendar' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 font-normal'}`}>截稿日</button>
            <button onClick={() => setCurrentView('sales')} className={`px-4 py-1.5 rounded-md text-sm transition-all ${currentView === 'sales' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 font-normal'}`}>業務分區進度</button>
          </div>
          
          {/* === 已修正：正確配置 SVG 屬性與 flexbox 置中邏輯 === */}
          <button onClick={handleOpenNew} className="h-9 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg shadow-sm transition-colors text-sm font-medium shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
            </svg>
            <span>新增專案</span>
          </button>
        </div>
      </nav>

      <main className="flex-1">
        {currentView === 'kanban' && <KanbanBoard refreshKey={refreshKey} onCopyProject={handleCopyProject} />}
        {currentView === 'calendar' && <CalendarView refreshKey={refreshKey} onCopyProject={handleCopyProject} />}
        {currentView === 'sales' && <SalesDashboard searchTerm={searchTerm} refreshKey={refreshKey} onCopyProject={handleCopyProject} />}
      </main>
      
      <ProjectDetailModal 
        project={searchSelectedProject} 
        onClose={() => setSearchSelectedProject(null)} 
        onProjectDeleted={() => { setRefreshKey(k => k + 1); setSearchSelectedProject(null); }}
        onProjectUpdated={() => { setRefreshKey(k => k + 1); setSearchSelectedProject(null); }}
        onStatusChange={(id, status, hasUnread) => setRefreshKey(k => k + 1)}
        onCopyProject={handleCopyProject} 
      />

      <NewProjectModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} onProjectAdded={() => setRefreshKey(prev => prev + 1)} initialData={copyData} />
    </div>
  );
}