import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useToast } from './toast';

export default function EditProjectModal({ isOpen, project, onClose, onProjectUpdated }) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const [formData, setFormData] = useState({
    name: '', deadline: '', teacher_name: '', teacher_email: '', scope: '', sales_rep: '', sales_assistant: '', production_staff: '', listening_types: '', reading_types: '', notes: ''
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

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isVisible) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  if (!isRendered || !project) return null;

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
      toast.success('變更已儲存');
    } catch (error) {
      toast.error('更新失敗：' + error.message);
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClassName = "w-full px-3 py-2 md:py-2.5 bg-paper-warm border border-line rounded-md focus:border-ink-faint focus:bg-white focus:shadow-[0_0_0_1px_var(--color-line)] outline-none text-sm text-ink transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)]";
  const labelClassName = "block text-xs font-bold text-ink-muted mb-1.5";

  return (
    <div 
      className={`fixed inset-0 bg-overlay/40 z-[60] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300 ease-out
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `} 
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="編輯專案"
        className={`bg-paper-warm rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] flex flex-col overflow-hidden text-ink transition-all duration-300 ease-out transform
          ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 sm:translate-y-12 scale-95'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        
        <div className="px-5 py-4 border-b border-line flex justify-between items-center bg-white shrink-0">
          <h2 className="text-lg md:text-xl font-bold text-ink">編輯專案</h2>
          <button onClick={onClose} aria-label="關閉" className="text-ink-muted hover:text-ink bg-paper p-1.5 rounded-md transition-colors shrink-0">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-8 bg-white">
          <form id="edit-project-form" onSubmit={handleSubmit} className="flex flex-col gap-6 md:gap-7">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div>
                <label className={labelClassName}>專案名稱 <span className="text-danger">*</span></label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClassName} required />
              </div>
              <div>
                <label className={labelClassName}>審稿截止日 <span className="text-danger">*</span></label>
                <input type="date" name="deadline" value={formData.deadline} onChange={handleChange} className={inputClassName} required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div>
                <label className={labelClassName}>閱卷老師 <span className="text-danger">*</span></label>
                <input type="text" name="teacher_name" value={formData.teacher_name} onChange={handleChange} className={inputClassName} required />
              </div>
              <div>
                <label className={labelClassName}>老師 Email <span className="text-danger">*</span></label>
                <input type="email" name="teacher_email" value={formData.teacher_email} onChange={handleChange} className={inputClassName} required />
              </div>
            </div>

            <div>
              <label className={labelClassName}>考試範圍 <span className="text-danger">*</span></label>
              <input type="text" name="scope" value={formData.scope} onChange={handleChange} className={inputClassName} required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 bg-paper/50 p-4 rounded-lg border border-line/50">
              <div>
                <label className={labelClassName}>負責業務 <span className="text-danger">*</span></label>
                <select name="sales_rep" value={formData.sales_rep} onChange={handleChange} className={inputClassName} required>
                  <option value="">請下拉選擇</option><option value="Deborah">Deborah</option><option value="Mark">Mark</option><option value="Richard">Richard</option>
                </select>
              </div>
              <div>
                <label className={labelClassName}>負責業助 <span className="text-danger">*</span></label>
                <select name="sales_assistant" value={formData.sales_assistant} onChange={handleChange} className={inputClassName} required>
                  <option value="">請下拉選擇</option><option value="Lisa">Lisa</option><option value="Jessica">Jessica</option><option value="Wanda">Wanda</option>
                </select>
              </div>
              <div>
                <label className={labelClassName}>製作人員 <span className="text-danger">*</span></label>
                <select name="production_staff" value={formData.production_staff} onChange={handleChange} className={inputClassName} required>
                  <option value="">請下拉選擇</option><option value="Ellery">Ellery</option><option value="Richard">Richard</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-ink-muted">聽力題型 <span className="text-danger">*</span></label>
                  {/* 🔥 更新：放大按鈕、改用 MUJI 燕麥色與微陰影 */}
                  <button type="button" onClick={() => handleCopyOld('listening_types')} className="text-xs bg-line text-accent px-3 py-1 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-line-strong hover:bg-line-strong transition-colors font-bold">照舊</button>
                </div>
                <textarea name="listening_types" value={formData.listening_types} onChange={handleChange} className={`${inputClassName} h-24 resize-none`} required></textarea>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-ink-muted">閱讀題型 <span className="text-danger">*</span></label>
                  {/* 🔥 更新：放大按鈕、改用 MUJI 燕麥色與微陰影 */}
                  <button type="button" onClick={() => handleCopyOld('reading_types')} className="text-xs bg-line text-accent px-3 py-1 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-line-strong hover:bg-line-strong transition-colors font-bold">照舊</button>
                </div>
                <textarea name="reading_types" value={formData.reading_types} onChange={handleChange} className={`${inputClassName} h-24 resize-none`} required></textarea>
              </div>
            </div>

            <div>
              <label className={labelClassName}>注意事項</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} className={`${inputClassName} h-16 resize-none`} placeholder="選填..."></textarea>
            </div>
            
          </form>
        </div>

        <div className="px-5 py-4 border-t border-line bg-paper-warm flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2 md:py-2.5 text-sm text-ink-soft bg-white border border-line hover:bg-paper rounded-md font-bold transition-colors">取消</button>
          <button type="submit" form="edit-project-form" disabled={isSubmitting} className="px-5 py-2 md:py-2.5 text-sm bg-accent text-white rounded-md font-bold hover:bg-accent-strong transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50">
            {isSubmitting ? '儲存中...' : '儲存變更'}
          </button>
        </div>

      </div>
    </div>
  );
}