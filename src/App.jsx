import { useState, useEffect } from 'react';
import KanbanBoard from './KanbanBoard';
import CalendarView from './CalendarView';
import SalesDashboard from './SalesDashboard'; 
import NewProjectModal from './NewProjectModal';
import ProjectDetailModal from './ProjectDetailModal';
import LoginScreen from './LoginScreen';
import { supabase } from './supabaseClient';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('team_tracker_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentView, setCurrentView] = useState('kanban'); 
  const [refreshKey, setRefreshKey] = useState(0); 
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [copyData, setCopyData] = useState(null); 
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchSelectedProject, setSearchSelectedProject] = useState(null);

  const handleLoginSuccess = (user) => {
    localStorage.setItem('team_tracker_user', JSON.stringify(user));
    setCurrentUser(user);
    const role = user.role?.toLowerCase() || '';
    if (role.includes('admin')) {
      setCurrentView('calendar');
    } else if (role.includes('sales')) {
      setCurrentView('sales');    
    } else {
      setCurrentView('kanban');   
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('team_tracker_user');
    setCurrentUser(null);
  };

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

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div 
      className="min-h-screen bg-gray-100 flex flex-col" 
      style={{ fontFamily: '"Swei Spring", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' }}
    >
      {/* RWD 優化：允許 Navbar 換行 (flex-wrap)，並在手機版微調 padding */}
      <nav className="bg-white shadow-sm border-b border-gray-200 px-4 md:px-8 py-3 flex flex-wrap md:flex-nowrap items-center justify-between z-10 sticky top-0 gap-y-3">
        
        {/* 左側：Logo 與 搜尋 (手機版佔據更多空間) */}
        <div className="flex items-center gap-2 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            </div>
            {/* RWD 優化：手機版隱藏標題，節省空間 */}
            <span className="font-bold text-gray-800 text-lg hidden lg:block">考題專案系統</span>
          </div>

          <div className="relative flex-1 md:flex-none ml-2">
            <svg className="w-4 h-4 md:w-5 md:h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="搜尋專案、老師..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all w-full md:w-[200px] lg:w-[260px] text-sm"
            />
            {searchTerm && searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full min-w-[240px] bg-white rounded-xl shadow-lg border border-gray-100 max-h-[350px] overflow-y-auto z-50">
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

        {/* 右側：按鈕與導航區 (RWD 優化：允許橫向滑動 hide-scrollbar) */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3 overflow-x-auto pb-1 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
            <button onClick={() => setCurrentView('kanban')} className={`px-3 md:px-4 py-1.5 rounded-md text-sm transition-all ${currentView === 'kanban' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 font-normal'}`}>全專案進度</button>
            <button onClick={() => setCurrentView('calendar')} className={`px-3 md:px-4 py-1.5 rounded-md text-sm transition-all ${currentView === 'calendar' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 font-normal'}`}>截稿日</button>
            <button onClick={() => setCurrentView('sales')} className={`px-3 md:px-4 py-1.5 rounded-md text-sm transition-all ${currentView === 'sales' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 font-normal'}`}>業務分區進度</button>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {currentUser.role?.toLowerCase() !== 'guest' && (
              <button onClick={handleOpenNew} className="h-9 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 rounded-lg shadow-sm transition-colors text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                </svg>
                {/* RWD 優化：手機版僅顯示 Icon */}
                <span className="hidden sm:inline">新增專案</span>
              </button>
            )}

            <div className="flex items-center gap-2 border-l border-gray-200 pl-3 md:pl-4">
              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden p-0.5 shadow-sm" title={`身份：${currentUser.name}`}>
                <img 
                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(currentUser.name)}&backgroundColor=b6e3f4,c0aede,d1d4f9`} 
                  alt={currentUser.name} 
                  className="w-full h-full object-contain" 
                />
              </div>
              <button 
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors whitespace-nowrap"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-x-hidden">
        {currentView === 'kanban' && <KanbanBoard refreshKey={refreshKey} onCopyProject={handleCopyProject} />}
        {currentView === 'calendar' && <CalendarView refreshKey={refreshKey} onCopyProject={handleCopyProject} />}
        {currentView === 'sales' && <SalesDashboard currentUser={currentUser} searchTerm={searchTerm} refreshKey={refreshKey} onCopyProject={handleCopyProject} />}
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