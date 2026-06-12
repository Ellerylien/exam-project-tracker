import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import confetti from 'canvas-confetti';
import EditProjectModal from './EditProjectModal';
import ConfirmDialog from './ConfirmDialog';
import { STATUSES } from './constants';
import { useToast } from './toast';
import { useUnreadRefresh } from './unread';

export default function ProjectDetailModal({ project, onClose, onStatusChange, onProjectDeleted, onProjectUpdated, onCopyProject }) {
  const [activeProject, setActiveProject] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  // { type: 'project' } 或 { type: 'comment', id }，控制刪除確認視窗
  const [confirmState, setConfirmState] = useState(null);

  const toast = useToast();
  const refreshUnread = useUnreadRefresh();

  const [loggedInUser, setLoggedInUser] = useState({ name: 'Guest' });

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

  useEffect(() => {
    const savedUser = localStorage.getItem('team_tracker_user');
    if (savedUser) setLoggedInUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    if (project) {
      setActiveProject(project);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setActiveProject(null), 300);
      return () => clearTimeout(timer);
    }
  }, [project]);

  useEffect(() => {
    // 編輯視窗或確認視窗開啟時讓它們自己處理 ESC，避免一次關閉兩層
    const handleKeyDown = (e) => { if (e.key === 'Escape' && isVisible && !isEditModalOpen && !confirmState) onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose, isEditModalOpen, confirmState]);

  useEffect(() => { 
    if (activeProject) {
      fetchComments(); 
      setReplyingTo(null); 
      setEditingCommentId(null);
      if (activeProject.has_unread) {
        supabase.from('projects').update({ has_unread: false }).eq('id', activeProject.id).then(({ error }) => {
          if (!error) {
            if (onStatusChange) onStatusChange(activeProject.id, activeProject.status, false);
            refreshUnread?.();
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

  // Realtime：訂閱目前開啟專案的留言變動，討論串即時更新
  useEffect(() => {
    if (!activeProject?.id) return;
    const channel = supabase
      .channel(`comments-${activeProject.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `project_id=eq.${activeProject.id}` }, () => fetchComments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

  async function fetchComments() {
    try {
      const { data, error } = await supabase.from('comments').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: true });
      if (error) throw error; setComments(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  async function handleAddComment() {
    if (!newComment.trim() || !loggedInUser.name) return;
    try {
      await supabase.from('comments').insert({ 
        project_id: activeProject.id, 
        author: loggedInUser.name, 
        content: newComment.trim(), 
        parent_id: replyingTo ? replyingTo.id : null 
      });
      setNewComment(''); setReplyingTo(null); fetchComments();
      if (loggedInUser.name !== 'Ellery') {
        await supabase.from('projects').update({ has_unread: true }).eq('id', activeProject.id);
        if (onStatusChange) onStatusChange(activeProject.id, activeProject.status, true);
        refreshUnread?.();
      }
    } catch (error) { console.error(error); toast.error('留言送出失敗，請再試一次'); }
  }

  const startEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleSaveEditComment = async (commentId) => {
    if (!editingContent.trim()) return;
    try {
      await supabase.from('comments').update({ content: editingContent.trim() }).eq('id', commentId);
      setEditingCommentId(null);
      setEditingContent('');
      fetchComments();
    } catch (error) { toast.error('修改留言失敗'); }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await supabase.from('comments').delete().eq('id', commentId);
      fetchComments();
      toast.success('留言已刪除');
    } catch (error) { toast.error('刪除留言失敗'); }
  };

  const handleDeleteProject = async () => {
    try {
      await supabase.from('projects').delete().eq('id', activeProject.id);
      toast.success(`「${activeProject.name}」已刪除`);
      onProjectDeleted();
      onClose();
    } catch { toast.error('刪除專案失敗'); }
  };

  const updateProjectStatus = async (newStatus, setUnread = false) => {
    const projectId = activeProject.id;
    const prevStatus = activeProject.status;
    try {
      await supabase.from('projects').update({ status: newStatus, has_unread: setUnread }).eq('id', projectId);
      if (onStatusChange) onStatusChange(projectId, newStatus, setUnread); onClose();
      refreshUnread?.();
      toast.success(`已移至「${newStatus}」`, {
        action: {
          label: '復原',
          onClick: async () => {
            await supabase.from('projects').update({ status: prevStatus }).eq('id', projectId);
            if (onStatusChange) onStatusChange(projectId, prevStatus, false);
          },
        },
      });
    } catch (error) { toast.error('更新失敗'); }
  };

  // 下拉選單切換狀態：手機無法拖曳看板卡片，這是行動裝置唯一的換階段途徑
  const handleStatusSelect = (newStatus) => {
    if (newStatus === activeProject.status) return;
    if (newStatus === '結案') confetti();
    updateProjectStatus(newStatus);
  };

  const handleCopyEmail = async () => {
    if (!activeProject.teacher_email) return;
    await navigator.clipboard.writeText(activeProject.teacher_email);
    setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000);
  };

  if (!activeProject) return null;

  const topLevelComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId) => comments.filter(c => c.parent_id === parentId);

  const renderCommentContent = (comment) => {
    if (editingCommentId === comment.id) {
      return (
        <div className="mt-2 mb-1">
          <textarea 
            value={editingContent} 
            onChange={(e) => setEditingContent(e.target.value)}
            className="w-full text-sm p-2.5 bg-card border border-line rounded-md outline-none focus:border-ink-faint shadow-[0_1px_2px_rgba(0,0,0,0.01)] resize-none h-16"
          />
          <div className="flex gap-2 mt-2">
            <button onClick={() => handleSaveEditComment(comment.id)} className="text-[11px] bg-accent text-paper px-3 py-1.5 rounded-md hover:bg-accent-strong font-bold transition-colors">儲存</button>
            <button onClick={() => setEditingCommentId(null)} className="text-[11px] bg-paper text-ink-soft px-3 py-1.5 rounded-md border border-line hover:bg-line font-bold transition-colors">取消</button>
          </div>
        </div>
      );
    }
    return <p className="text-sm text-ink-soft leading-relaxed break-words mt-0.5">{comment.content}</p>;
  };

  const renderCommentActions = (comment, isSystem) => (
    <div className="flex items-center gap-3 mt-2.5 text-ink-faint">
      {/* 🔥 調整：判斷如果沒有 parent_id（代表是主留言），才顯示回覆按鈕 */}
      {!comment.parent_id && (
        <button onClick={() => setReplyingTo(comment)} title="回覆" className="hover:text-ink-soft transition-colors">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>
        </button>
      )}
      
      {!isSystem && comment.author === loggedInUser.name && (
        <>
          <button onClick={() => startEditComment(comment)} title="編輯" className="hover:text-ink-soft transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button onClick={() => setConfirmState({ type: 'comment', id: comment.id })} title="刪除" className="hover:text-danger transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <div 
        className={`fixed inset-0 bg-overlay/40 z-50 flex items-center justify-center p-2 md:p-4 backdrop-blur-sm transition-opacity duration-300 ease-out
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `} 
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeProject.name}
          className={`bg-paper-warm rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] flex flex-col overflow-hidden text-ink transition-all duration-300 ease-out transform
            ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 sm:translate-y-12 scale-95'}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          
          <div className="px-5 py-4 border-b border-line flex flex-col gap-3 bg-card shrink-0">
            <div className="flex justify-between items-start gap-2">
              <h2 className="text-lg md:text-xl font-bold break-words pr-2">{activeProject.name}</h2>
              <button onClick={onClose} aria-label="關閉" className="text-ink-muted hover:text-ink bg-paper p-1.5 rounded-md transition-colors shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { onCopyProject(activeProject); onClose(); }} title="複製專案" className="w-8 h-8 flex items-center justify-center bg-paper text-ink-soft rounded-md hover:bg-line hover:text-ink transition-colors border border-line">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
              <button onClick={() => setIsEditModalOpen(true)} title="修改內容" className="w-8 h-8 flex items-center justify-center bg-paper text-ink-soft rounded-md hover:bg-line hover:text-ink transition-colors border border-line">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button onClick={() => setConfirmState({ type: 'project' })} title="刪除" className="w-8 h-8 flex items-center justify-center bg-danger-bg text-danger rounded-md hover:bg-danger-line/50 transition-colors border border-danger-line/60">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-8 bg-card">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm border-b border-line pb-8">
              <div className="flex flex-col gap-1">
                <span className="text-xs md:text-[13px] font-bold text-ink-muted mb-0.5">當前狀態</span>
                <div className="relative w-fit">
                  <select
                    value={activeProject.status}
                    onChange={(e) => handleStatusSelect(e.target.value)}
                    className="appearance-none bg-paper border border-line hover:border-line-strong rounded-md pl-3 pr-9 py-1.5 text-sm font-semibold text-ink cursor-pointer focus:outline-none focus:border-line-strong transition-colors"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-ink-muted">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
              {[
                { label: '截止日期', value: activeProject.deadline || '未設定' },
                { label: '考試範圍', value: activeProject.scope || '無' },
                { label: '負責業務', value: activeProject.sales_rep },
                { label: '負責業助', value: activeProject.sales_assistant },
                { label: '製作人員', value: activeProject.production_staff }
              ].map(item => (
                <div key={item.label} className="flex flex-col gap-1">
                  <span className="text-xs md:text-[13px] font-bold text-ink-muted mb-0.5">{item.label}</span>
                  <span className={`text-sm md:text-base font-semibold ${item.highlight ? 'text-ink' : 'text-ink-soft'}`}>{item.value}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-6 text-sm">
              <div><span className="text-xs md:text-[13px] font-bold text-ink-muted block mb-1">閱卷老師</span><span className="text-sm md:text-base font-semibold">{activeProject.teacher_name || '無'}</span></div>
              <div><span className="text-xs md:text-[13px] font-bold text-ink-muted block mb-1">老師 Email</span>
                <div role="button" tabIndex={activeProject.teacher_email ? 0 : -1} onClick={handleCopyEmail} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyEmail(); } }} className="flex items-center gap-2 cursor-pointer group w-fit">
                  <span className="text-sm md:text-base font-semibold text-ink-soft group-hover:underline">{activeProject.teacher_email || '無'}</span>
                  {activeProject.teacher_email && (
                    <span className="text-[11px] bg-paper text-ink-muted px-1.5 py-0.5 rounded border border-line flex items-center gap-1">
                      {emailCopied ? '已複製' : <><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> 複製</>}
                    </span>
                  )}
                </div>
              </div>
              <div><span className="text-xs md:text-[13px] font-bold text-ink-muted block mb-2">注意事項</span><p className="font-medium text-ink-soft whitespace-pre-wrap leading-relaxed bg-paper p-4 rounded-lg border border-line">{activeProject.notes || '尚無備註'}</p></div>
            </div>

            {activeProject.status === '待老師回覆' && (
              <div className="bg-warning-bg/60 border border-warning-line/40 p-5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-sm font-bold text-warning">老師回覆處理</span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => updateProjectStatus('修改題目', true)} className="flex-1 sm:flex-none bg-card text-danger px-5 py-2 rounded-md text-sm font-bold border border-danger-line">需修改</button>
                  <button onClick={() => { confetti(); updateProjectStatus('製作錄音稿與學生卷', true); }} className="flex-1 sm:flex-none bg-accent hover:bg-accent-strong text-paper px-5 py-2 rounded-md text-sm font-bold transition-colors">確認無誤</button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-ink-muted border-b border-line pb-2">討論與記錄</h3>
              <div className="flex flex-col gap-6">
                {topLevelComments.map(comment => (
                  <div key={comment.id} className="flex gap-3 md:gap-4 group">
                    <div className="w-10 h-10 shrink-0 bg-card border border-line rounded-full overflow-hidden p-0.5">
                      <img src={getAvatarUrl(comment.author)} alt={comment.author} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm font-bold text-ink">{comment.author}</span>
                        <span className="text-[11px] text-ink-muted">{new Date(comment.created_at).toLocaleString('zh-TW', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                      </div>
                      
                      {renderCommentContent(comment)}
                      {renderCommentActions(comment, comment.author === '🌟 系統通知')}
                      
                      {getReplies(comment.id).map(reply => (
                        <div key={reply.id} className="flex gap-2 md:gap-3 mt-4 pl-3 border-l-2 border-line">
                          <div className="w-7 h-7 shrink-0 bg-card border border-line rounded-full overflow-hidden p-0.5 mt-0.5">
                            <img src={getAvatarUrl(reply.author)} alt={reply.author} className="w-full h-full object-contain" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="text-xs font-bold text-ink">{reply.author}</span>
                              <span className="text-[11px] text-ink-muted">{new Date(reply.created_at).toLocaleString('zh-TW', { hour:'2-digit', minute:'2-digit' })}</span>
                            </div>
                            
                            {renderCommentContent(reply)}
                            {renderCommentActions(reply, reply.author === '🌟 系統通知')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-line bg-paper-warm shrink-0">
            {replyingTo && (
              <div className="flex items-center justify-between bg-card text-ink-soft text-xs px-3 py-2 rounded-md border border-line mb-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                <span className="truncate">正在回覆 <strong>{replyingTo.author}</strong> : {replyingTo.content}</span>
                <button onClick={() => setReplyingTo(null)} className="ml-2 font-bold hover:text-danger">&times;</button>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 items-center">
              <div className="hidden sm:flex w-8 h-8 rounded-full border border-line bg-card items-center justify-center overflow-hidden shrink-0 shadow-sm">
                <img src={getAvatarUrl(loggedInUser.name)} alt={loggedInUser.name} className="w-full h-full object-contain p-0.5" />
              </div>
              <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} placeholder={replyingTo ? `回覆給 ${replyingTo.author}...` : "輸入討論內容..."} className="flex-1 w-full px-4 py-2 bg-card rounded-md outline-none text-sm placeholder:text-ink-faint border border-line focus:border-line-strong transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)]" />
              <button onClick={handleAddComment} title="送出" className="w-full sm:w-10 h-10 flex items-center justify-center bg-accent text-paper rounded-md hover:bg-accent-strong shadow-sm transition-colors shrink-0">
                <svg className="w-4 h-4 translate-x-[-1px] translate-y-[1px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <EditProjectModal isOpen={isEditModalOpen} project={activeProject} onClose={() => setIsEditModalOpen(false)} onProjectUpdated={() => onProjectUpdated && onProjectUpdated()} />
      <ConfirmDialog
        open={!!confirmState}
        danger
        confirmLabel="刪除"
        title={confirmState?.type === 'project' ? '刪除專案' : '刪除留言'}
        description={confirmState?.type === 'project'
          ? `確定要刪除「${activeProject.name}」嗎？相關討論記錄將一併消失，且無法復原。`
          : '確定要刪除這則留言嗎？刪除後無法復原。'}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          const pending = confirmState;
          setConfirmState(null);
          if (pending?.type === 'project') handleDeleteProject();
          else if (pending?.type === 'comment') handleDeleteComment(pending.id);
        }}
      />
    </>
  );
}