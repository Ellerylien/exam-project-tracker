import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function NewProjectModal({ isOpen, onClose, onProjectAdded, initialData }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopyMode, setIsCopyMode] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '', deadline: '', teacher_name: '', teacher_email: '', scope: '', sales_rep: '', sales_assistant: '', production_staff: '', listening_types: '', reading_types: '', notes: '', status: '排隊區'
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setIsCopyMode(true);
        setFormData({
          ...initialData,
          deadline: '',       
          status: '排隊區',    
        });
      } else {
        setIsCopyMode(false);
        setFormData({ name: '', deadline: '', teacher_name: '', teacher_email: '', scope: '', sales_rep: '', sales_assistant: '', production_staff: '', listening_types: '', reading_types: '', notes: '', status: '排隊區' });
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // === 核心修正：將 id 徹底從送出的資料中剔除 ===
      const { id, ...dataToInsert } = formData;
      
      const { error } = await supabase.from('projects').insert([dataToInsert]);
      if (error) throw error;
      onProjectAdded();
      onClose();
    } catch (error) {
      alert('新增失敗：' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const CopyWarning = () => isCopyMode ? <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded ml-2 animate-pulse font-normal">⚠️ 請記得修改</span> : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">
            {isCopyMode ? '複製專案 (Copy Project)' : '新增專案 (New Project)'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="new-project-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">專案名稱 <span className="text-red-500">*</span> <CopyWarning /></label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">審稿截止日 <span className="text-red-500">*</span></label>
                <input type="date" name="deadline" value={formData.deadline} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">閱卷老師 <span className="text-red-500">*</span> <CopyWarning /></label>
                <input type="text" name="teacher_name" value={formData.teacher_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">老師 Email <span className="text-red-500">*</span> <CopyWarning /></label>
                <input type="email" name="teacher_email" value={formData.teacher_email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">考試範圍 <span className="text-red-500">*</span> <CopyWarning /></label>
              <input type="text" name="scope" value={formData.scope} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">負責業務 <span className="text-red-500">*</span></label>
                <select name="sales_rep" value={formData.sales_rep} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white" required>
                  <option value="">請下拉選擇</option><option value="Deborah">Deborah</option><option value="Mark">Mark</option><option value="Richard">Richard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">負責業助 <span className="text-red-500">*</span></label>
                <select name="sales_assistant" value={formData.sales_assistant} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white" required>
                  <option value="">請下拉選擇</option><option value="Lisa">Lisa</option><option value="Jessica">Jessica</option><option value="Wanda">Wanda</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">製作人員 <span className="text-red-500">*</span></label>
                <select name="production_staff" value={formData.production_staff} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white" required>
                  <option value="">請下拉選擇</option><option value="Ellery">Ellery</option><option value="Richard">Richard</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">聽力題型 <span className="text-red-500">*</span></label>
                <textarea name="listening_types" value={formData.listening_types} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg h-20 resize-none outline-none" required></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">閱讀題型 <span className="text-red-500">*</span></label>
                <textarea name="reading_types" value={formData.reading_types} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg h-20 resize-none outline-none" required></textarea>
              </div>
            </div>

            <div><label className="block text-sm font-medium text-gray-700 mb-1">注意事項</label><textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg h-16 resize-none outline-none"></textarea></div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">取消</button>
          <button type="submit" form="new-project-form" disabled={isSubmitting} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
            {isSubmitting ? '處理中...' : (isCopyMode ? '儲存複製專案' : '儲存專案')}
          </button>
        </div>
      </div>
    </div>
  );
}