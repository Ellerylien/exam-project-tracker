import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import ProjectDetailModal from './ProjectDetailModal';
import NewProjectModal from './NewProjectModal';
import { supabase } from './supabaseClient';
import { getHandoffDeadlineInfo, COUNTDOWN_STATUSES } from './deadline';
import { STATUSES } from './constants';
import Skeleton from './Skeleton';
import ReminderList from './ReminderList';
import { useToast } from './toast';
import { computeReminders, currentSchoolYear, parseExamName, sameSlot } from './reminders';

const SALES_REPS = ['Deborah', 'Mark', 'Richard'];

// 從提醒建立申請時，沿用上一次案件的這些欄位；範圍與審稿日每次都不同，留白重填。
// 閱卷老師另外判斷：確定每次都同一位才帶入（見 reminders.js 的 teacherHistory）
const CARRY_OVER_FIELDS = ['sales_assistant', 'production_staff', 'listening_types', 'reading_types', 'notes'];

const matchesSearch = (term, ...values) => {
  const needle = term.trim().toLowerCase();
  return !needle || values.some(v => v?.toLowerCase().includes(needle));
};

// 清單排序分三段：還沒交件的（依死線由近到遠，逾期最上面）→ 已交件的（依製作進度）→ 結案
const sortTier = (status) => (status === '結案' ? 2 : COUNTDOWN_STATUSES.includes(status) ? 0 : 1);

// 指標卡的單一事實來源：卡片數字與點擊後的清單共用同一個 match，
// 兩者永遠不會對不上。配色只放語意化 token，暗色模式自動跟著翻轉；
// 選取與否由高度（陰影階層）表達，不靠描邊。
// 死線不另設指標卡：清單本身就把最急的排在最上面。
const STAT_CARDS = [
  {
    key: 'waiting',
    label: '待老師回覆 (需追蹤)',
    caption: '目前進度為待老師回覆，等著我方追蹤',
    match: (p) => p.status === '待老師回覆',
    surface: 'bg-warning-bg border-warning-line/30',
    text: 'text-warning',
  },
  {
    key: 'unfinished',
    label: '未結案總數',
    caption: '所有尚未結案的案件',
    match: (p) => p.status !== '結案',
    surface: 'bg-info-bg border-info-line/30',
    text: 'text-info',
  },
  {
    // 這張卡數的不是專案，而是「還沒建立的申請」：沒有 match，清單改由 ReminderList 顯示。
    // 虛線框呼應「尚未存在」，與其他實色狀態卡區隔
    key: 'reminders',
    label: '待申請提醒',
    caption: '依已申請的案件推算，下一次還沒建立申請的考試',
    surface: 'bg-card border-dashed border-line-strong',
    text: 'text-ink-soft',
  },
];

export default function SalesDashboard({ currentUser, searchTerm, refreshKey, onCopyProject }) {
  const toast = useToast();
  const canEdit = currentUser?.role?.toLowerCase() !== 'guest';

  // 抓全部業務的專案：待申請提醒要看完整清單才判斷得出「還沒申請」，
  // 系列換業務負責時也才歸得對人。業務篩選與搜尋都在前端做。
  const [allProjects, setAllProjects] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  // 從提醒建立申請：createFrom 在關閉動畫期間保留，避免表單內容瞬間清空
  const [createFrom, setCreateFrom] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // activeFilter：目前套用的指標卡（null = 預設無篩選）
  // lastCardKey：最後被點過的那張卡，取消篩選時讓標籤還能演完退場
  const [activeFilter, setActiveFilter] = useState(null);
  const [lastCardKey, setLastCardKey] = useState(null);

  // 清單外層容器：切換篩選時要把高度從舊值補間到新值，否則長度會硬跳
  const listRef = useRef(null);
  const prevListHeightRef = useRef(null);

  const [selectedSales, setSelectedSales] = useState(
    currentUser?.role?.toLowerCase() === 'sales' ? currentUser.name : 'Deborah'
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projectResult, overrideResult] = await Promise.all([
        supabase.from('projects').select('*').order('deadline', { ascending: true }),
        supabase.from('reminder_overrides').select('*').order('created_at', { ascending: true }),
      ]);

      if (projectResult.error) throw projectResult.error;
      setAllProjects(projectResult.data || []);
      // 提醒只是輔助資訊：例外記錄讀不到時照樣顯示推算結果，不擋住整個儀表板
      if (overrideResult.error) console.warn('讀取提醒例外記錄失敗', overrideResult.error);
      setOverrides(overrideResult.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const projects = useMemo(() => (
    allProjects.filter(p => p.sales_rep === selectedSales && matchesSearch(searchTerm, p.name, p.teacher_name, p.scope))
  ), [allProjects, selectedSales, searchTerm]);

  const reminders = useMemo(() => (
    computeReminders(allProjects, overrides)
      .filter(r => r.salesRep === selectedSales && matchesSearch(searchTerm, r.name, r.basedOn?.teacher_name))
  ), [allProjects, overrides, selectedSales, searchTerm]);

  // 「已略過」清單：只列這位業務、本學年仍有效的略過；停止提醒的系列不分學年都列出
  const skippedOverrides = useMemo(() => {
    const thisYear = currentSchoolYear();
    return overrides.filter(o =>
      o.sales_rep === selectedSales &&
      (o.kind === 'stop_series' || (['skip', 'end_term'].includes(o.kind) && o.school_year >= thisYear)));
  }, [overrides, selectedSales]);

  const counts = useMemo(() => (
    Object.fromEntries(STAT_CARDS.map(card => [
      card.key,
      card.match ? projects.filter(card.match).length : reminders.length,
    ]))
  ), [projects, reminders]);

  const saveOverride = async (row, successText) => {
    const { data, error } = await supabase
      .from('reminder_overrides')
      .insert([{ ...row, created_by: currentUser?.name ?? null }])
      .select()
      .single();
    if (error) { toast.error('儲存失敗：' + error.message); return false; }
    setOverrides(prev => [...prev, data]);
    if (successText) toast.success(successText);
    return true;
  };

  const removeOverride = async (id, successText) => {
    const { error } = await supabase.from('reminder_overrides').delete().eq('id', id);
    if (error) { toast.error('操作失敗：' + error.message); return false; }
    setOverrides(prev => prev.filter(o => o.id !== id));
    if (successText) toast.success(successText);
    return true;
  };

  const slotColumns = (slot) => ({
    series_key: slot.seriesKey, school_year: slot.schoolYear, term: slot.term, exam_no: slot.examNo,
  });

  const handleSkip = (reminder, kind) => saveOverride(
    { kind, ...slotColumns(reminder.slot), name: reminder.name, sales_rep: reminder.salesRep },
    kind === 'stop_series' ? '此系列已停止提醒，可在「已略過」復原' : '已略過，可在「已略過」復原',
  );

  const handleAddManual = (name) => saveOverride(
    { kind: 'manual', name, sales_rep: selectedSales },
    '已新增提醒',
  );

  const openCreateFromReminder = (reminder) => {
    setCreateFrom(reminder);
    setIsCreateOpen(true);
  };

  const createPrefill = useMemo(() => {
    if (!createFrom) return null;
    const base = createFrom.basedOn;
    if (!base) {
      return {
        data: { name: createFrom.name, sales_rep: createFrom.salesRep },
        note: '已帶入名稱與負責業務，其餘欄位請填寫，或上傳申請表自動帶入。',
        teacherOptions: [],
      };
    }

    const carried = Object.fromEntries(CARRY_OVER_FIELDS.map(field => [field, base[field]]));
    const fixedTeacher = createFrom.teacherFixed ? createFrom.teachers[0] : null;
    return {
      data: {
        ...carried,
        ...(fixedTeacher && { teacher_name: fixedTeacher.teacher_name, teacher_email: fixedTeacher.teacher_email }),
        name: createFrom.name,
        sales_rep: createFrom.salesRep,
      },
      note: fixedTeacher
        ? `已依「${base.name}」帶入業助、製作人員與題型。本學年這個系列每次都是 ${fixedTeacher.teacher_name.replace(/\s*老師$/, '')} 老師，已一併帶入。考試範圍與審稿截止日請重新填寫，也可以直接上傳新的申請表覆蓋。`
        : `已依「${base.name}」帶入業助、製作人員與題型。閱卷老師可能每次不同，請填寫或點選下方之前的老師；考試範圍與審稿截止日也請重新填寫，或直接上傳新的申請表。`,
      teacherOptions: createFrom.teachers,
    };
  }, [createFrom]);

  // 建好申請後提醒通常會自動消失（名稱推得回同一格）。
  // 若業務改了名稱導致對不上，補一筆「已申請」，免得提醒還掛著；手動提醒則直接刪掉。
  const handleCreatedFromReminder = async (created) => {
    if (!created) return;
    setAllProjects(prev => [...prev, created]);
    const reminder = createFrom;
    if (!reminder) return;
    if (reminder.type === 'manual') {
      await removeOverride(reminder.override.id);
    } else if (!sameSlot(parseExamName(created.name), reminder.slot)) {
      await saveOverride({ kind: 'applied', ...slotColumns(reminder.slot), name: created.name, sales_rep: created.sales_rep });
    }
  };

  const activeCard = STAT_CARDS.find(card => card.key === activeFilter) ?? null;
  // 取消篩選時 activeCard 已成 null，但標籤還得留著把退場演完，所以看的是最後點過的那張
  const chipCard = STAT_CARDS.find(card => card.key === lastCardKey) ?? null;

  // 先套用指標篩選，再依 sortTier 分段排序（已交件的同一段內依製作進度，其餘依死線由近到遠）
  const sortedProjects = useMemo(() => {
    const scoped = activeCard?.match ? projects.filter(activeCard.match) : projects;
    return [...scoped].sort((a, b) => {
      const tier = sortTier(a.status) - sortTier(b.status);
      if (tier !== 0) return tier;
      const stage = sortTier(a.status) === 1 ? STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) : 0;
      return stage || (a.deadline || '9999').localeCompare(b.deadline || '9999');
    });
  }, [projects, activeCard]);

  // 點同一張卡＝取消篩選回到預設；點另一張卡＝直接切換
  const toggleFilter = (key) => {
    // 在 React 重繪前先記下目前高度，供下面的 useLayoutEffect 當補間起點
    prevListHeightRef.current = listRef.current?.offsetHeight ?? null;
    setLastCardKey(key);
    setActiveFilter(prev => (prev === key ? null : key));
  };

  // 清單高度補間：在瀏覽器繪製前把高度鎖回舊值，再過渡到新值，
  // 讓「8 列變 2 列」是滑順收合而不是瞬間跳掉。
  useLayoutEffect(() => {
    const el = listRef.current;
    const from = prevListHeightRef.current;
    prevListHeightRef.current = null;

    if (!el || from === null) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const to = el.offsetHeight;
    if (from === to) return;

    el.style.overflow = 'hidden';
    el.style.height = `${from}px`;
    el.getBoundingClientRect(); // 強制 reflow，讓起始高度真的生效
    // 容器高度屬於「間接位移」，用兩端都平緩的 ease-in-out，
    // 不用卡片那種前重後輕的 ease-out，否則高度會在前 150ms 幾乎收完＝還是像在跳
    el.style.transition = 'height 400ms cubic-bezier(0.4, 0, 0.2, 1)';
    el.style.height = `${to}px`;

    const reset = () => {
      el.style.height = '';
      el.style.overflow = '';
      el.style.transition = '';
    };
    const timer = setTimeout(reset, 420);
    return () => { clearTimeout(timer); reset(); };
  }, [activeFilter]);

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
            <Skeleton className="h-6 w-[84px]" />
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
          其餘幾張退到後面（降透明度與飽和度），讓「現在正在看什麼」一眼可辨。 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STAT_CARDS.map(card => {
          const isActive = activeFilter === card.key;
          const isDimmed = activeFilter !== null && !isActive;

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => toggleFilter(card.key)}
              aria-pressed={isActive}
              title={card.caption}
              aria-label={`${card.label}，${counts[card.key]} 件。${isActive ? '篩選中，再按一次顯示全部' : `按一下只顯示${card.label}的案件`}`}
              className={`group relative text-left rounded-xl border p-5 flex flex-col justify-between min-h-[110px] cursor-pointer
                transition-[translate,scale,opacity] duration-[360ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none
                active:scale-[0.98] active:duration-100
                ${card.surface}
                ${isActive ? '-translate-y-1.5' : 'hover:-translate-y-0.5'}
                ${isDimmed ? 'opacity-50 scale-[0.98]' : ''}
              `}
            >
              {/* 三階高度各自獨立一層、只補間 opacity 互相交棒。
                  box-shadow 每一幀都要重繪，讓它自己參與過渡就是掉幀主因；
                  opacity 則是合成器直接處理，怎麼疊都不會卡。 */}
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 rounded-xl shadow-[var(--elevation-rest)]
                  transition-opacity duration-[360ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none
                  ${isActive ? 'opacity-0' : 'opacity-100'}`}
              />
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 rounded-xl shadow-[var(--elevation-hover)]
                  transition-opacity duration-[360ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none
                  opacity-0 ${isActive ? '' : 'group-hover:opacity-100'}`}
              />
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 rounded-xl shadow-[var(--elevation-lift)]
                  transition-opacity duration-[360ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none
                  ${isActive ? 'opacity-100' : 'opacity-0'}`}
              />

              <div className="flex items-start justify-between gap-2">
                <div className={`${card.text} text-xs font-semibold tracking-wide`}>{card.label}</div>
                {/* 未選取時是淡淡的漏斗（暗示可篩選），選取後轉為勾選 */}
                <span
                  aria-hidden="true"
                  className={`relative shrink-0 w-5 h-5 rounded-full border ${card.text}
                    transition-all duration-[360ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none
                    ${isActive ? 'opacity-100 scale-100 border-current' : 'opacity-30 scale-90 border-transparent group-hover:opacity-60'}`}
                >
                  {/* 兩個圖示疊在一起互相淡入淡出，避免瞬間抽換造成的跳動 */}
                  <span className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-out motion-reduce:transition-none ${isActive ? 'opacity-0' : 'opacity-100'}`}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                  </span>
                  <span className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-out motion-reduce:transition-none ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </span>
                </span>
              </div>

              {/* 數字本身不做動畫：它在切換篩選時根本沒變，彈一下只會變成雜訊。
                  點擊的回饋交給卡片的下壓與浮起。 */}
              <div className={`text-3xl font-bold ${card.text} mt-2 flex items-baseline gap-1`}>
                <span>{counts[card.key]}</span>
                <span className="text-xs font-normal opacity-80">件</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 專案進度直列清單：改為平面無框感，靠細線優雅分割 */}
      <div className="bg-card rounded-xl border border-line/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="px-5 py-3 border-b border-paper bg-paper/50 flex items-center justify-between gap-3 min-h-[52px]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted shrink-0">
            {activeFilter === 'reminders' ? '待申請清單' : '專案進度清單'}
          </h2>

          {/* 篩選中的狀態列：常駐在 DOM 裡，用透明度與位移進退場，
              取消篩選時才有退場動畫，而不是整塊瞬間不見 */}
          {chipCard && (
            <div
              aria-hidden={!activeCard}
              className={`flex items-center gap-2.5 min-w-0 transform-gpu transition-[opacity,transform] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none
                ${activeCard ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1.5 pointer-events-none'}`}
            >
              <span className="hidden md:inline text-[11px] text-ink-faint truncate">{chipCard.caption}</span>
              <button
                type="button"
                tabIndex={activeCard ? 0 : -1}
                onClick={() => toggleFilter(chipCard.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 h-6 pl-2.5 pr-1.5 rounded-full border text-[11px] font-semibold cursor-pointer
                  ${chipCard.surface} ${chipCard.text} hover:opacity-75 transition-opacity duration-200 motion-reduce:transition-none`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                <span className="whitespace-nowrap">{chipCard.label} · {chipCard.match ? sortedProjects.length : reminders.length} 件</span>
                <svg className="w-3.5 h-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                <span className="sr-only">清除篩選</span>
              </button>
            </div>
          )}
        </div>

        {/* 外層有 ref、不隨篩選重新掛載，負責把高度平滑補間；
            內層 key 隨篩選改變 → 重新掛載以重播漸進進場 */}
        <div ref={listRef}>
        <div key={activeFilter ?? 'all'} className="flex flex-col">
          {activeFilter === 'reminders' ? (
            <ReminderList
              reminders={reminders}
              skipped={skippedOverrides}
              canEdit={canEdit}
              onCreate={openCreateFromReminder}
              onSkip={handleSkip}
              onDeleteManual={(reminder) => removeOverride(reminder.override.id, '已刪除提醒')}
              onAddManual={handleAddManual}
              onRestore={(override) => removeOverride(override.id, '已復原提醒')}
            />
          ) : sortedProjects.length === 0 ? (
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
              const deadlineInfo = getHandoffDeadlineInfo(project.deadline, project.status);
              
              return (
                <div
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.currentTarget.blur(); setSelectedProject(project); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProject(project); } }}
                  style={{ animationDelay: `${Math.min(index, 6) * 26}ms` }}
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
                    <div
                      title={project.deadline ? `審稿截止日 ${project.deadline}` : undefined}
                      className={`shrink-0 w-[84px] whitespace-nowrap text-center font-semibold py-0.5 md:py-1 rounded border text-[11px] md:text-xs tracking-wide ${deadlineInfo.color}`}
                    >
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
      </div>

      {/* 核心連動 Modal 機制 */}
      <ProjectDetailModal 
        project={selectedProject} 
        onClose={() => setSelectedProject(null)} 
        onProjectDeleted={() => {
          setAllProjects(prev => prev.filter(p => p.id !== selectedProject?.id));
          setSelectedProject(null);
        }}
        onProjectUpdated={() => {
          fetchData();
        }}
        onStatusChange={(id, newStatus, hasUnread) => {
          setAllProjects(prev =>
            prev.map(p => 
              p.id === id ? { ...p, status: newStatus, has_unread: hasUnread } : p
            )
          );
        }}
        onCopyProject={onCopyProject} 
      />
      
      <NewProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        prefill={createPrefill}
        onProjectAdded={handleCreatedFromReminder}
        currentUser={currentUser}
      />
    </div>
  );
}