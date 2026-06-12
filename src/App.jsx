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

const AVATAR_MAP = { 
    'Deborah': 'Deborah_6', 'Lisa': 'Lisa_50', 'Jessica': 'Jessica_16', 
    'Wanda': 'Wanda_40', 'Mark': 'Mark_33', 'Richard': 'Richard_58', 
    'Ellery': 'Ellery_9', 'Guest': 'Guest_5' 
  };

  const getAvatarUrl = (name) => { 
    if (!name) return `https://api.dicebear.com/7.x/notionists/svg?seed=fallback`;
    
    // 🔥 防呆機制：強制去除名字前後的不小心打到的空白字元
    const cleanName = name.trim();
    
    // 尋找對應的專屬編號，找不到就用原本的名字產圖
    const seed = AVATAR_MAP[cleanName] || cleanName; 
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}`; 
  };

  const handleLoginSuccess = (user) => {
    localStorage.setItem('team_tracker_user', JSON.stringify(user));
    setCurrentUser(user);
    const role = user.role?.toLowerCase() || '';
    if (role.includes('admin')) setCurrentView('calendar');
    else if (role.includes('sales')) setCurrentView('sales');    
    else setCurrentView('kanban');   
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
    if (!searchTerm.trim()) { setSearchResults([]); return; }
    const fetchSearch = async () => {
      const { data, error } = await supabase.from('projects').select('*')
        .or(`name.ilike.%${searchTerm}%,teacher_name.ilike.%${searchTerm}%,scope.ilike.%${searchTerm}%`).limit(8);
      if (!error && data) setSearchResults(data);
    };
    const timer = setTimeout(() => fetchSearch(), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  if (!currentUser) return <LoginScreen onLoginSuccess={handleLoginSuccess} />;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <nav className="bg-white shadow-[0_1px_2px_rgba(0,0,0,0.01)] border-b border-line px-4 md:px-8 py-3 flex flex-wrap md:flex-nowrap items-center justify-between z-10 sticky top-0 gap-y-3">
        
        <div className="flex items-center gap-2 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3 shrink-0">
            {/* 🔥 修改：直接改用內建 SVG，避免外部圖片讀取失敗 */}
            <div className="w-8 h-8 rounded-lg border border-line bg-white shadow-sm flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
              </svg>
            </div>
            <span className="font-bold text-ink text-lg hidden lg:block tracking-wide">考題專案系統</span>
          </div>

          <div className="relative flex-1 md:flex-none ml-2">
            <svg className="w-4 h-4 md:w-5 md:h-5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" placeholder="搜尋專案、老師..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 bg-paper border border-line rounded-lg focus:outline-none focus:bg-white focus:border-line-strong transition-all w-full md:w-[200px] lg:w-[260px] text-sm text-ink placeholder:text-ink-faint"
            />
            {searchTerm && searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full min-w-[240px] bg-white rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-line max-h-[350px] overflow-y-auto z-50">
                <div className="p-3 text-xs text-ink-muted font-bold border-b border-paper">搜尋結果 ({searchResults.length})</div>
                {searchResults.map(p => (
                  <div key={p.id} role="button" tabIndex={0} onClick={(e) => { e.currentTarget.blur(); setSearchSelectedProject(p); setSearchTerm(''); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSearchSelectedProject(p); setSearchTerm(''); } }} className="p-3 border-b border-paper hover:bg-paper cursor-pointer">
                    <div className="font-bold text-ink truncate text-sm">{p.name}</div>
                    <div className="flex justify-between items-center mt-1.5 text-xs text-ink-muted">
                      <span>{p.sales_rep}</span>
                      <span className="bg-line/50 text-ink-soft px-2 py-0.5 rounded-md font-medium border border-line">{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between w-full md:w-auto gap-2 md:gap-3">
          <div className="flex bg-paper p-1 rounded-lg min-w-0 overflow-x-auto hide-scrollbar">
            <button onClick={() => setCurrentView('kanban')} className={`whitespace-nowrap px-2.5 md:px-4 py-1.5 rounded-md text-xs md:text-sm transition-all ${currentView === 'kanban' ? 'bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.03)] font-bold border border-line' : 'text-ink-muted hover:text-ink-soft font-medium'}`}>全專案進度</button>
            <button onClick={() => setCurrentView('calendar')} className={`whitespace-nowrap px-2.5 md:px-4 py-1.5 rounded-md text-xs md:text-sm transition-all ${currentView === 'calendar' ? 'bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.03)] font-bold border border-line' : 'text-ink-muted hover:text-ink-soft font-medium'}`}>截稿日</button>
            <button onClick={() => setCurrentView('sales')} className={`whitespace-nowrap px-2.5 md:px-4 py-1.5 rounded-md text-xs md:text-sm transition-all ${currentView === 'sales' ? 'bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.03)] font-bold border border-line' : 'text-ink-muted hover:text-ink-soft font-medium'}`}>業務分區進度</button>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {currentUser.role?.toLowerCase() !== 'guest' && (
              <button onClick={handleOpenNew} className="h-8 md:h-9 flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-strong text-white px-2.5 md:px-4 rounded-md transition-colors text-sm font-medium shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                <span className="hidden sm:inline">新增專案</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 md:gap-2 border-l border-line pl-2 md:pl-4">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white border border-line flex items-center justify-center overflow-hidden p-0.5 shadow-sm" title={`身份：${currentUser.name}`}>
                <img src={getAvatarUrl(currentUser.name)} alt={currentUser.name} className="w-full h-full object-contain" />
              </div>
              <button onClick={handleLogout} className="text-xs text-ink-muted hover:text-danger font-medium transition-colors whitespace-nowrap">
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
      
      <ProjectDetailModal project={searchSelectedProject} onClose={() => setSearchSelectedProject(null)} onProjectDeleted={() => { setRefreshKey(k => k + 1); setSearchSelectedProject(null); }} onProjectUpdated={() => { setRefreshKey(k => k + 1); setSearchSelectedProject(null); }} onStatusChange={(id, status, hasUnread) => setRefreshKey(k => k + 1)} onCopyProject={handleCopyProject} />
      <NewProjectModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} onProjectAdded={() => setRefreshKey(prev => prev + 1)} initialData={copyData} />
    </div>
  );
}