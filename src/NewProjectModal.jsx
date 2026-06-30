import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { useToast } from './toast';
import ConfirmDialog from './ConfirmDialog';

const EMPTY_FORM = {
  name: '', deadline: '', teacher_name: '', teacher_email: '', scope: '', sales_rep: '', sales_assistant: '', production_staff: '', listening_types: '', reading_types: '', notes: '', status: '排隊區'
};

// 下拉選單裡的人員，用來把登入身份對應到正確的欄位（規則 6）
const SALES = ['Deborah', 'Mark', 'Richard'];
const ASSISTANTS = ['Lisa', 'Jessica', 'Wanda'];
const PRODUCTION = ['Ellery', 'Richard'];

// 依登入者的身份預選負責業務／業助／製作人員。Richard 同時在業務與製作名單，
// 以角色（role）為主：sales → 業務，其它（admin/製作）→ 製作人員。
function identityDefaults(user) {
  const out = {};
  const name = (user?.name || '').trim();
  const role = (user?.role || '').toLowerCase();
  if (!name || role.includes('guest')) return out;
  if (role.includes('sales') && SALES.includes(name)) out.sales_rep = name;
  else if (role.includes('assistant') && ASSISTANTS.includes(name)) out.sales_assistant = name;
  else if (PRODUCTION.includes(name)) out.production_staff = name;
  return out;
}

export default function NewProjectModal({ isOpen, onClose, onProjectAdded, initialData, currentUser }) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopyMode, setIsCopyMode] = useState(false);

  // 上傳申請表自動帶入
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parseNote, setParseNote] = useState(null); // { type: 'ok'|'warn'|'error', text }
  const fileInputRef = useRef(null);

  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  // 表單有未儲存變動時，關閉前先確認
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const initialFormRef = useRef(JSON.stringify(EMPTY_FORM));

  const [formData, setFormData] = useState(EMPTY_FORM);

  const requestClose = () => {
    if (JSON.stringify(formData) !== initialFormRef.current) setConfirmDiscard(true);
    else onClose();
  };

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
      // 捨棄確認視窗開啟時由它自己處理 ESC
      if (e.key === 'Escape' && isVisible && !confirmDiscard) requestClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    if (isOpen) {
      setConfirmDiscard(false);
      setParseNote(null);
      // 全新專案：依登入身份預選負責業務／業助／製作人員（規則 6）
      const initial = initialData
        ? { ...initialData, deadline: '', status: '排隊區' }
        : { ...EMPTY_FORM, ...identityDefaults(currentUser) };
      setIsCopyMode(!!initialData);
      setFormData(initial);
      initialFormRef.current = JSON.stringify(initial);
    }
  }, [isOpen, initialData, currentUser]);

  if (!isRendered) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSetSameAsBefore = (field) => {
    setFormData(prev => ({ ...prev, [field]: '照舊' }));
  };

  // 上傳段考申請表 → 後端讀檔＋規則擷取欄位 → 自動帶入表單（之後可手動調整）
  const parseFile = async (file) => {
    if (!file) return;
    if (!/\.(doc|docx)$/i.test(file.name)) {
      setParseNote({ type: 'error', text: '請上傳 .doc 或 .docx 申請表檔案' });
      return;
    }
    setIsParsing(true);
    setParseNote(null);
    try {
      const dataBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('讀取檔案失敗'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/parse-exam-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, dataBase64 }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || '解析失敗');

      const d = json.data;
      setFormData(prev => ({
        ...prev,
        ...identityDefaults(currentUser),     // 規則 6：先用登入身份預選（含製作人員）
        ...(d.name ? { name: d.name } : {}),
        ...(d.deadline ? { deadline: d.deadline } : {}),
        ...(d.teacher_name ? { teacher_name: d.teacher_name } : {}),
        ...(d.teacher_email ? { teacher_email: d.teacher_email } : {}),
        scope: d.scope || '',                 // 規則 5：如備註／找不到 → 留白
        notes: d.notes || '',
        listening_types: '照舊',              // 規則 8：題型預設照舊
        reading_types: '照舊',
        ...(d.sales_rep ? { sales_rep: d.sales_rep } : {}),                 // 申請表上的負責業務優先
        ...(d.sales_assistant ? { sales_assistant: d.sales_assistant } : {}),
      }));

      const src = json.meta?.deadline_source;
      if (src === 'receipt-10') {
        setParseNote({ type: 'warn', text: '已帶入。審稿截止日是由「學校收件日」往回推 10 天估算，請務必確認。' });
      } else if (src === 'none') {
        setParseNote({ type: 'warn', text: '已帶入，但未掃描到審題日／收件日，請手動填寫審稿截止日。' });
      } else {
        setParseNote({ type: 'ok', text: '已帶入，請核對各欄位後再儲存。' });
      }
      toast.success('申請表已帶入');
    } catch (err) {
      setParseNote({ type: 'error', text: err.message || '解析失敗' });
      toast.error('解析失敗：' + (err.message || ''));
    } finally {
      setIsParsing(false);
    }
  };

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 清掉，讓使用者能重新選同一個檔
    parseFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isParsing) return;
    parseFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { id, ...dataToInsert } = formData;
      const { error } = await supabase.from('projects').insert([dataToInsert]);
      if (error) throw error;
      onProjectAdded();
      onClose();
      toast.success(`「${formData.name}」已建立`);
    } catch (error) {
      toast.error('新增失敗：' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const CopyWarning = () => isCopyMode ? <span className="text-[11px] text-danger bg-danger-bg border border-danger-line/60 px-1.5 py-0.5 rounded ml-2 animate-pulse font-normal tracking-wider">⚠️ 請記得修改</span> : null;

  const inputClassName = "w-full px-3 py-2 md:py-2.5 bg-paper-warm border border-line rounded-md focus:border-ink-faint focus:bg-card focus:shadow-[0_0_0_1px_var(--color-line)] outline-none text-sm text-ink transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)]";
  const labelClassName = "block text-xs font-bold text-ink-muted mb-1.5";

  return (
    <>
    <div
      className={`fixed inset-0 bg-overlay/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300 ease-out
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isCopyMode ? '複製專案' : '新增專案'}
        className={`bg-paper-warm rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] flex flex-col overflow-hidden text-ink transition-all duration-300 ease-out transform
          ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 sm:translate-y-12 scale-95'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        
        <div className="px-5 py-4 border-b border-line flex justify-between items-center bg-card shrink-0">
          <h2 className="text-lg md:text-xl font-bold text-ink">
            {isCopyMode ? '複製專案' : '新增專案'}
          </h2>
          <button onClick={requestClose} aria-label="關閉" className="text-ink-muted hover:text-ink bg-paper p-1.5 rounded-md transition-colors shrink-0">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-8 bg-card">
          <form id="new-project-form" onSubmit={handleSubmit} className="flex flex-col gap-6 md:gap-7">

            {!isCopyMode && (
              <div
                onDragOver={(e) => { e.preventDefault(); if (!isParsing) setIsDragging(true); }}
                onDragEnter={(e) => { e.preventDefault(); if (!isParsing) setIsDragging(true); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
                onDrop={handleDrop}
                className={`rounded-lg border border-dashed p-4 flex flex-col gap-3 transition-colors ${
                  isDragging ? 'border-accent bg-accent/10' : 'border-line-strong bg-paper/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-ink flex items-center gap-2">
                      <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                      傳段考申請表
                    </div>
                    <p className="text-xs text-ink-muted mt-1">支援 .doc / .docx，可<span className="font-medium text-ink-soft">直接把檔案拖曳到這個框</span>，或按右側按鈕選擇。系統會自動擷取成品名稱、審題日、老師、業務／業助、範圍、備註等欄位，帶入後仍可手動調整。</p>
                  </div>
                  <button
                    type="button"
                    disabled={isParsing}
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 px-4 py-2 text-sm bg-accent text-paper rounded-md font-bold hover:bg-accent-strong transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60"
                  >
                    {isParsing ? '解析中…' : '選擇檔案'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={handleFilePicked}
                  />
                </div>
                {isDragging && (
                  <div className="text-xs text-accent font-bold text-center py-1 pointer-events-none">放開即可上傳…</div>
                )}
                {parseNote && (
                  <div className={`text-xs rounded-md px-3 py-2 border ${
                    parseNote.type === 'ok' ? 'bg-info-bg text-info border-info-line/40'
                    : parseNote.type === 'warn' ? 'bg-warning-bg text-warning border-warning-line/40'
                    : 'bg-danger-bg text-danger border-danger-line/40'}`}>
                    {parseNote.text}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div>
                <label className={labelClassName}>專案名稱 <span className="text-danger">*</span> <CopyWarning /></label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClassName} required />
              </div>
              <div>
                <label className={labelClassName}>審稿截止日 <span className="text-danger">*</span></label>
                <input type="date" name="deadline" value={formData.deadline} onChange={handleChange} className={inputClassName} required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div>
                <label className={labelClassName}>閱卷老師 <span className="text-danger">*</span> <CopyWarning /></label>
                <input type="text" name="teacher_name" value={formData.teacher_name} onChange={handleChange} className={inputClassName} required />
              </div>
              <div>
                <label className={labelClassName}>老師 Email <span className="text-danger">*</span> <CopyWarning /></label>
                <input type="email" name="teacher_email" value={formData.teacher_email} onChange={handleChange} className={inputClassName} required />
              </div>
            </div>

            <div>
              <label className={labelClassName}>考試範圍 <span className="text-danger">*</span> <CopyWarning /></label>
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
                  <button type="button" onClick={() => handleSetSameAsBefore('listening_types')} className="text-xs bg-line text-accent px-3 py-1 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-line-strong hover:bg-line-strong transition-colors font-bold">
                    照舊
                  </button>
                </div>
                <textarea name="listening_types" value={formData.listening_types} onChange={handleChange} className={`${inputClassName} h-24 resize-none`} required></textarea>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-ink-muted">閱讀題型 <span className="text-danger">*</span></label>
                  {/* 🔥 更新：放大按鈕、改用 MUJI 燕麥色與微陰影 */}
                  <button type="button" onClick={() => handleSetSameAsBefore('reading_types')} className="text-xs bg-line text-accent px-3 py-1 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-line-strong hover:bg-line-strong transition-colors font-bold">
                    照舊
                  </button>
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
          <button type="button" onClick={requestClose} className="px-5 py-2 md:py-2.5 text-sm text-ink-soft bg-card border border-line hover:bg-paper rounded-md font-bold transition-colors">
            取消
          </button>
          <button type="submit" form="new-project-form" disabled={isSubmitting} className="px-5 py-2 md:py-2.5 text-sm bg-accent text-paper rounded-md font-bold hover:bg-accent-strong transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50">
            {isSubmitting ? '處理中...' : (isCopyMode ? '儲存複製專案' : '儲存專案')}
          </button>
        </div>
      </div>
    </div>
    <ConfirmDialog
      open={confirmDiscard}
      danger
      title="捨棄未儲存的內容？"
      description="表單內容尚未儲存，關閉後將會消失。"
      confirmLabel="捨棄"
      onCancel={() => setConfirmDiscard(false)}
      onConfirm={() => { setConfirmDiscard(false); onClose(); }}
    />
    </>
  );
}