import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import ProjectDetailModal from './ProjectDetailModal';

export default function CalendarView({ refreshKey, onCopyProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchProjects();
  }, [refreshKey]);

  async function fetchProjects() {
    try {
      const { data, error } = await supabase.from('projects').select('*');
      if (error) throw error;
      const filteredData = data.filter(p => ['排隊區', '出題中'].includes(p.status));
      setProjects(filteredData);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); 
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  let startingDay = firstDayOfMonth.getDay() - 1;
  if (startingDay === -1) startingDay = 6; 
  
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const calendarCells = [];
  for (let i = 0; i < startingDay; i++) {
    calendarCells.push({ empty: true, key: `empty-${i}` });
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayProjects = projects.filter(p => p.deadline === dateString);
    calendarCells.push({ empty: false, date: day, dateString, projects: dayProjects, key: `day-${day}` });
  }

  const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

  if (loading) return <div className="p-10 text-center text-gray-500">資料載入中...</div>;

  return (
    <div className="p-8 font-sans">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">截稿日曆區</h1>
          <p className="text-gray-500 mt-1 text-sm">僅顯示處於「排隊區」與「出題中」的專案 📅</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
          <button onClick={prevMonth} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
          <span className="text-lg font-bold text-gray-700 min-w-[120px] text-center">{year} 年 {month + 1} 月</span>
          <button onClick={nextMonth} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></button>
          <button onClick={goToToday} className="ml-2 text-sm font-medium text-blue-600 hover:text-blue-800">回到今天</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {WEEKDAYS.map((day, index) => (
            <div key={day} className={`py-3 text-center text-sm font-bold ${index >= 5 ? 'text-red-500' : 'text-gray-600'}`}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[minmax(140px,_auto)]">
          {calendarCells.map((cell) => {
            if (cell.empty) return <div key={cell.key} className="bg-gray-50 border-r border-b border-gray-100"></div>;

            const isToday = cell.dateString === new Date().toISOString().split('T')[0];

            return (
              <div key={cell.key} className="border-r border-b border-gray-100 p-2 hover:bg-gray-50 transition-colors">
                <div className={`text-sm font-medium mb-2 flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700'}`}>
                  {cell.date}
                </div>
                
                <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-1 pb-1">
                  {cell.projects.map(project => (
                    <div 
                      key={project.id} onClick={() => setSelectedProject(project)}
                      className={`text-xs px-2 py-1.5 rounded-md cursor-pointer border truncate transition-all hover:shadow-sm shrink-0
                        ${project.status === '排隊區' ? 'bg-white border-gray-200 text-gray-700' : 'bg-blue-50 border-blue-200 text-blue-700 font-medium'}`}
                      title={`${project.name}\n負責業務: ${project.sales_rep || '無'}`}
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

      <ProjectDetailModal 
        project={selectedProject} 
        onClose={() => setSelectedProject(null)} 
        onProjectDeleted={() => { fetchProjects(); setSelectedProject(null); }}
        onProjectUpdated={() => { fetchProjects(); setSelectedProject(null); }}
        onCopyProject={onCopyProject}
      />
    </div>
  );
}