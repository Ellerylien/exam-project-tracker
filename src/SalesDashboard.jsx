import { useState, useEffect, useMemo } from 'react';
import ProjectDetailModal from './ProjectDetailModal';
import NewProjectModal from './NewProjectModal';
import { supabase } from './supabaseClient';
import { getDeadlineInfo, isUrgent } from './deadline';
import Skeleton from './Skeleton';

const SALES_REPS = ['Deborah', 'Mark', 'Richard'];

// 「近期死線」看的是真正會出事的案子：3 天內截稿、而製作進度還卡在最前段
const AT_RISK_STATUSES = ['排隊區', '出題中'];

// 三張指標卡的單一事實來源：卡片數字與點擊後的清單共用同一個 match，
// 兩者永遠不會對不上。tone 只放語意化 token，暗色模式自動跟著翻轉。
const STAT_CARDS = [
  {
    key: 'urgent',
    label: '近期死線 (3天內)',
    caption: '3 天內截稿，且進度仍停在排隊區或出題中',
    match: (p) => isUrgent(p.deadline, p.status) && AT_RISK_STATUSES.includes(p.status),
    surface: 'bg-danger-bg border-danger-line/30',
    text: 'text-danger',
    ring: 'ring-danger/45',
    glow: 'shadow-[0_10px_22px_-14px_var(--color-danger)]',
    halo: 'border-danger',
  },
  {
    key: 'waiting',
    label: '待老師回覆 (需追蹤)',
    caption: '目前進度為待老師回覆，等著我方追蹤',
    match: (p) => p.status === '待老師回覆',
    surface: 'bg-warning-bg border-warning-line/30',
    text: 'text-warning',
    ring: 'ring-warning/45',
    glow: 'shadow-[0_10px_22px_-14px_var(--color-warning)]',
    halo: 'border-warning',
  },
  {
    key: 'unfinished',
    label: '未結案總數',
    caption: '所有尚未結案的案件',
    match: (p) => p.status !== '結案',
    surface: 'bg-info-bg border-info-line/30',
    text: 'text-info',
    ring: 'ring-info/45',
    glow: 'shadow-[0_10px_22px_-14px_var(--color-info)]',
    halo: 'border-info',
  },
];

export default function SalesDashboard({ currentUser, searchTerm, refreshKey, onCopyProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [copyData, setCopyData] = useState(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // activeFilter：目前套用的指標卡（null = 預設無篩選）
  // pulse：只記錄「最後被點到的那張卡 + 遞增序號」，用來重播點擊動畫（選取與取消都會播）
  const [activeFilter, setActiveFilter] = useState(null);
  const [pulse, setPulse] = useState({ key: null, n: 0 });

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

  const counts = useMemo(() => (
    Object.fromEntries(STAT_CARDS.map(card => [card.key, projects.filter(card.match).length]))
  ), [projects]);

  const activeCard = STAT_CARDS.find(card => card.key === activeFilter) ?? null;

  // 先套用指標篩選，再讓已結案的專案沉底，其餘維持原本的死線由近至遠排序
  const sortedProjects = useMemo(() => {
    const scoped = activeCard ? projects.filter(activeCard.match) : projects;
    return [...scoped].sort((a, b) => {
      const aClosed = a.status === '結案' ? 1 : 0;
      const bClosed = b.status === '結案' ? 1 : 0;
      return aClosed - bClosed;
    });
  }, [projects, activeCard]);

  // 點同一張卡＝取消篩選回到預設；點另一張卡＝直接切換
  const toggleFilter = (key) => {
    setPulse(prev => ({ key, n: prev.n + 1 }));
    setActiveFilter(prev => (prev === key ? null : key));
  };

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

      {/* 數據統計卡片：Notion 呼叫區塊（Callout）配色，同時是清單的篩選開關。
          點一下 = 只看這一類；再點一下 = 回到預設。選取的卡浮起 + 描邊 + 光暈擴散，
          其餘兩張退到後面（降透明度與飽和度），讓「現在正在看什麼」一眼可辨。 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STAT_CARDS.map(card => {
          const isActive = activeFilter === card.key;
          const isDimmed = activeFilter !== null && !isActive;
          const isPulsing = pulse.key === card.key;

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => toggleFilter(card.key)}
              aria-pressed={isActive}
              title={card.caption}
              aria-label={`${card.label}，${counts[card.key]} 件。${isActive ? '篩選中，再按一次顯示全部' : `按一下只顯示${card.label}的案件`}`}
              className={`group relative text-left rounded-xl border p-5 flex flex-col justify-between min-h-[110px] cursor-pointer
                transition-[transform,opacity,box-shadow,filter] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none
                active:scale-[0.98] active:duration-100
                ${card.surface}
                ${isActive
                  ? `-translate-y-1 ring-2 ring-offset-2 ring-offset-paper ${card.ring} ${card.glow}`
                  : 'hover:-translate-y-0.5 hover:shadow-[0_8px_18px_-12px_rgba(0,0,0,0.35)]'}
                ${isDimmed ? 'opacity-45 saturate-[0.55] scale-[0.98]' : ''}
              `}
            >
              {/* 每次點擊（選取或取消）都由卡片邊緣向外擴散一次的光暈，是最明確的「我收到了」回饋 */}
              {isPulsing && (
                <span
                  key={`halo-${pulse.n}`}
                  aria-hidden="true"
                  className={`pointer-events-none absolute -inset-px rounded-xl border-2 ${card.halo} animate-halo motion-reduce:hidden`}
                />
              )}

              <div className="flex items-start justify-between gap-2">
                <div className={`${card.text} text-xs font-semibold tracking-wide`}>{card.label}</div>
                {/* 未選取時是淡淡的漏斗（暗示可篩選），選取後轉為勾選 */}
                <span
                  aria-hidden="true"
                  className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full border ${card.text}
                    transition-all duration-300 ease-out motion-reduce:transition-none
                    ${isActive ? 'opacity-100 scale-100 border-current' : 'opacity-30 scale-90 border-transparent group-hover:opacity-60'}`}
                >
                  {isActive ? (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  ) : (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                  )}
                </span>
              </div>

              <div className={`text-3xl font-bold ${card.text} mt-2 flex items-baseline gap-1`}>
                {/* key 隨點擊次數改變 → 重新掛載以重播彈跳，選取與取消都會播一次 */}
                <span
                  key={isPulsing ? `pop-${pulse.n}` : 'idle'}
                  className={`inline-block ${isPulsing ? 'animate-count-pop' : ''} motion-reduce:animate-none`}
                >
                  {counts[card.key]}
                </span>
                <span className="text-xs font-normal opacity-80">件</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 專案進度直列清單：改為平面無框感，靠細線優雅分割 */}
      <div className="bg-card rounded-xl border border-line/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="px-5 py-3 border-b border-paper bg-paper/50 flex items-center justify-between gap-3 min-h-[52px]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted shrink-0">專案進度清單</h2>

          {/* 篩選中的狀態列：說明條件、顯示筆數，並提供第二個「回到預設」的出口 */}
          {activeCard && (
            <div key={activeCard.key} className="flex items-center gap-2.5 min-w-0 animate-chip-enter motion-reduce:animate-none">
              <span className="hidden md:inline text-[11px] text-ink-faint truncate">{activeCard.caption}</span>
              <button
                type="button"
                onClick={() => toggleFilter(activeCard.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 h-6 pl-2.5 pr-1.5 rounded-full border text-[11px] font-semibold cursor-pointer
                  ${activeCard.surface} ${activeCard.text} hover:opacity-75 transition-opacity duration-200 motion-reduce:transition-none`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                <span className="whitespace-nowrap">{activeCard.label} · {sortedProjects.length} 件</span>
                <svg className="w-3.5 h-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                <span className="sr-only">清除篩選</span>
              </button>
            </div>
          )}
        </div>

        {/* key 隨篩選改變 → 整份清單重新掛載，重播漸進進場，讓「換了一批資料」被看見 */}
        <div key={activeFilter ?? 'all'} className="flex flex-col">
          {sortedProjects.length === 0 ? (
            activeCard ? (
              <div className="p-12 md:p-16 flex flex-col items-center gap-3 text-center animate-row-enter motion-reduce:animate-none">
                <div className="w-12 h-12 rounded-full bg-paper border border-line flex items-center justify-center">
                  <svg className="w-5 h-5 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                </div>
                <div className="text-ink-muted text-sm font-medium">「{activeCard.label}」目前沒有符合的案件</div>
                <div className="text-ink-faint text-xs">{activeCard.caption}</div>
                <button
                  type="button"
                  onClick={() => toggleFilter(activeCard.key)}
                  className="mt-1 px-3 py-1.5 rounded-md text-xs font-bold text-ink-soft bg-card border border-line hover:bg-paper hover:border-line-strong transition-colors cursor-pointer"
                >
                  清除篩選
                </button>
              </div>
            ) : (
              <div className="p-12 md:p-16 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-paper border border-line flex items-center justify-center">
                  <svg className="w-5 h-5 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
                </div>
                <div className="text-ink-muted text-sm font-medium">目前尚無相關專案</div>
                <div className="text-ink-faint text-xs">試試切換業務，或調整搜尋關鍵字</div>
              </div>
            )
          ) : (
            sortedProjects.map((project, index) => {
              const deadlineInfo = getDeadlineInfo(project.deadline, project.status);
              
              return (
                <div
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.currentTarget.blur(); setSelectedProject(project); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProject(project); } }}
                  style={{ animationDelay: `${Math.min(index, 8) * 32}ms` }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:px-5 md:py-4 border-b border-paper last:border-b-0 hover:bg-paper/60 cursor-pointer transition-colors gap-3 group relative animate-row-enter motion-reduce:animate-none"
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