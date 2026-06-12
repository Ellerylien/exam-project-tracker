import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import ProjectDetailModal from './ProjectDetailModal';

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

  if (loading) return <div className="p-10 text-[#938A82] text-sm font-medium">載入中...</div>;

  return (
    <div className="p-4 md:p-8 font-sans bg-[#F7F5F0] min-h-screen">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#4A4542]">截稿日</h1>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-[#EBE6DF] shadow-sm">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 text-[#938A82] hover:text-[#4A4542]"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
          <span className="text-sm md:text-base font-bold text-[#4A4542] min-w-[100px] text-center">{year} 年 {month + 1} 月</span>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 text-[#938A82] hover:text-[#4A4542]"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></button>
          <button onClick={() => setCurrentDate(new Date())} className="ml-2 text-xs font-bold text-[#938A82] hover:text-[#4A4542] border-l border-[#EBE6DF] pl-3">今天</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#EBE6DF] overflow-x-auto hide-scrollbar">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-7 bg-[#F7F5F0]/50 border-b border-[#EBE6DF]">
            {WEEKDAYS.map((day, idx) => (
              <div key={day} className={`py-2.5 text-center text-[11px] font-bold uppercase tracking-widest ${idx >= 5 ? 'text-red-400' : 'text-[#938A82]'}`}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-[minmax(100px,_auto)] md:auto-rows-[minmax(140px,_auto)]">
            {calendarCells.map((cell) => {
              if (cell.empty) return <div key={cell.key} className="bg-[#F7F5F0]/30 border-r border-b border-[#F7F5F0]"></div>;
              const isToday = cell.dateString === new Date().toISOString().split('T')[0];
              return (
                <div key={cell.key} className="border-r border-b border-[#EBE6DF] p-2 hover:bg-[#F7F5F0]/50 transition-colors">
                  <div className={`text-xs font-bold mb-2 flex items-center justify-center w-6 h-6 rounded-md ${isToday ? 'bg-[#4A4542] text-white shadow-sm' : 'text-[#938A82]'}`}>
                    {cell.date}
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto hide-scrollbar">
                    {cell.projects.map(project => (
                      <div 
                        key={project.id} 
                        onClick={() => setSelectedProject(project)}
                        className={`text-xs px-2 py-1.5 rounded-md border truncate cursor-pointer hover:border-[#D1C9BE] transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.01)]
                          ${project.status === '排隊區' ? 'bg-white text-[#635B56]' : 'bg-[#EDF3F5] text-[#2B5D72] border-[#D3E3E8]/40'}`}
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