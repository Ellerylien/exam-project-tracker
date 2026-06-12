import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import ProjectDetailModal from './ProjectDetailModal';
import Skeleton from './Skeleton';

export default function CalendarView({ refreshKey, onCopyProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => { fetchProjects(); }, [refreshKey]);
  async function fetchProjects() {
    try {
      const { data, error } = await supabase.from('projects').select('*');
      if (error) throw error;
      setProjects(data.filter(p => ['排隊區', '出題中'].includes(p.status)));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); 
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startingDay = firstDayOfMonth.getDay() - 1; if (startingDay === -1) startingDay = 6; 
  
  const calendarCells = [];
  for (let i = 0; i < startingDay; i++) calendarCells.push({ empty: true, key: `empty-${i}` });
  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarCells.push({ empty: false, date: day, dateString, projects: projects.filter(p => p.deadline === dateString), key: `day-${day}` });
  }

  const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

  if (loading) return (
    <div className="p-4 md:p-8 bg-paper min-h-screen">
      <div className="mb-6 flex justify-between items-end">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-9 w-52 rounded-md" />
      </div>
      <div className="bg-white rounded-xl border border-line overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line py-2.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex justify-center"><Skeleton className="h-3 w-6" /></div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="border-r border-b border-paper p-2 h-[100px] md:h-[140px]">
              <Skeleton className="h-5 w-5 rounded-md mb-2" />
              {i % 5 === 1 && <Skeleton className="h-6 w-full rounded-md" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 font-sans bg-paper min-h-screen">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-ink">截稿日</h1>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-line shadow-sm">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 text-ink-muted hover:text-ink"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
          <span className="text-sm md:text-base font-bold text-ink min-w-[100px] text-center">{year} 年 {month + 1} 月</span>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 text-ink-muted hover:text-ink"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></button>
          <button onClick={() => setCurrentDate(new Date())} className="ml-2 text-xs font-bold text-ink-muted hover:text-ink border-l border-line pl-3">今天</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-line overflow-x-auto hide-scrollbar">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-7 bg-paper/50 border-b border-line">
            {WEEKDAYS.map((day, idx) => (
              <div key={day} className={`py-2.5 text-center text-[11px] font-bold uppercase tracking-widest ${idx >= 5 ? 'text-danger' : 'text-ink-muted'}`}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-[minmax(100px,_auto)] md:auto-rows-[minmax(140px,_auto)]">
            {calendarCells.map((cell) => {
              if (cell.empty) return <div key={cell.key} className="bg-paper/30 border-r border-b border-paper"></div>;
              const isToday = cell.dateString === new Date().toISOString().split('T')[0];
              return (
                <div key={cell.key} className="border-r border-b border-line p-2 hover:bg-paper/50 transition-colors">
                  <div className={`text-xs font-bold mb-2 flex items-center justify-center w-6 h-6 rounded-md ${isToday ? 'bg-ink text-white shadow-sm' : 'text-ink-muted'}`}>
                    {cell.date}
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto hide-scrollbar">
                    {cell.projects.map(project => (
                      <div
                        key={project.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.currentTarget.blur(); setSelectedProject(project); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProject(project); } }}
                        className={`text-xs px-2 py-1.5 rounded-md border truncate cursor-pointer hover:border-line-strong transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.01)]
                          ${project.status === '排隊區' ? 'bg-white text-ink-soft' : 'bg-info-bg text-info border-info-line/40'}`}
                      >
                        {project.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ProjectDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} onProjectDeleted={() => { fetchProjects(); setSelectedProject(null); }} onProjectUpdated={() => { fetchProjects(); setSelectedProject(null); }} onCopyProject={onCopyProject} />
    </div>
  );
}