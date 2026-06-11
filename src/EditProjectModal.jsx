import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function EditProjectModal({ isOpen, project, onClose, onProjectUpdated }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    deadline: '',
    teacher_name: '',
    teacher_email: '',
    scope: '',
    sales_rep: '',
    sales_assistant: '',
    production_staff: '',
    listening_types: '',
    reading_types: '',
    notes: ''
  });

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        deadline: project.deadline || '',
        teacher_name: project.teacher_name || '',
        teacher_email: project.teacher_email || '',
        scope: project.scope || '',
        sales_rep: project.sales_rep || '',
        sales_assistant: project.sales_assistant || '',
        production_staff: project.production_staff || '',
        listening_types: project.listening_types || '',
        reading_types: project.reading_types || '',
        notes: project.notes || ''
      });
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCopyOld = (field) => {
    setFormData(prev => ({ ...prev, [field]: '照舊' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update(formData)
        .eq('id', project.id);

      if (error) throw error;
      
      onProjectUpdated();
      onClose();
    } catch (error) {
      alert('更新失敗：' + error.message);
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">編輯專案 (Edit Project)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="edit-project-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">專案名稱 <span className="text-red-500">*</span></label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">審稿截止日 <span className="text-red-500">*</span></label>
                <input type="date" name="deadline" value={formData.deadline} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">閱卷老師 <span className="text-red-500">*</span></label>
                <input type="text" name="teacher_name" value={formData.teacher_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">老師 Email <span className="text-red-500">*</span></label>
                <input type="email" name="teacher_email" value={formData.teacher_email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">考試範圍 <span className="text-red-500">*</span></label>
              <input type="text" name="scope" value={formData.scope} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">負責業務 <span className="text-red-500">*</span></label>
                <select name="sales_rep" value={formData.sales_rep} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" required>
                  <option value="">請下拉選擇</option>
                  <option value="Deborah">Deborah</option>
                  <option value="Mark">Mark</option>
                  <option value="Richard">Richard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">負責業助 <span className="text-red-500">*</span></label>
                <select name="sales_assistant" value={formData.sales_assistant} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" required>
                  <option value="">請下拉選擇</option>
                  <option value="Lisa">Lisa</option>
                  <option value="Jessica">Jessica</option>
                  <option value="Wanda">Wanda</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">製作人員 <span className="text-red-500">*</span></label>
                <select name="production_staff" value={formData.production_staff} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" required>
                  <option value="">請下拉選擇</option>
                  <option value="Ellery">Ellery</option>
                  <option value="Richard">Richard</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-medium text-gray-700">聽力題型 <span className="text-red-500">*</span></label>
                  <button type="button" onClick={() => handleCopyOld('listening_types')} className="text-xs bg-[#b3745a] text-white px-2 py-1 rounded hover:bg-[#9a624b] transition-colors">照舊</button>
                </div>
                <textarea name="listening_types" value={formData.listening_types} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none" required></textarea>
              </div>
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-medium text-gray-700">閱讀題型 <span className="text-red-500">*</span></label>
                  <button type="button" onClick={() => handleCopyOld('reading_types')} className="text-xs bg-[#b3745a] text-white px-2 py-1 rounded hover:bg-[#9a624b] transition-colors">照舊</button>
                </div>
                <textarea name="reading_types" value={formData.reading_types} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none" required></textarea>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">注意事項</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
            </div>
            
          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">取消</button>
          <button type="submit" form="edit-project-form" disabled={isSubmitting} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            {isSubmitting ? '儲存中...' : '儲存變更'}
          </button>
        </div>

      </div>
    </div>
  );
}