import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import confetti from 'canvas-confetti';
import EditProjectModal from './EditProjectModal';

const TEAM_MEMBERS = ['Deborah', 'Mark', 'Richard', 'Lisa', 'Jessica', 'Wanda', 'Ellery'];

export default function ProjectDetailModal({ project, onClose, onStatusChange, onProjectDeleted, onProjectUpdated, onCopyProject }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('exam_tracker_user') || 'Ellery');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && project) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, onClose]);

  useEffect(() => { 
    if (project) {
      fetchComments();
      setReplyingTo(null);
      setEditingCommentId(null);

      // === 核心邏輯：只要一打開卡片，就把「未讀變色」給消除掉 ===
      if (project.has_unread) {
        supabase.from('projects').update({ has_unread: false }).eq('id', project.id).then(({ error }) => {
          if (!error && onStatusChange) {
            onStatusChange(project.id, project.status, false); // 通知看板改回白色
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const handleUserChange = (e) => {
    const user = e.target.value;
    setCurrentUser(user);
    localStorage.setItem('exam_tracker_user', user);
  };

  async function fetchComments() {
    try {
      const { data, error } = await supabase.from('comments').select('*').eq('project_id', project.id).order('created_at', { ascending: true });
      if (error) throw error;
      setComments(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  async function handleAddComment() {
    if (!newComment.trim() || !currentUser) return;
    try {
      await supabase.from('comments').insert({ 
        project_id: project.id, 
        author: currentUser, 
        content: newComment.trim(),
        parent_id: replyingTo ? replyingTo.id : null 
      });
      setNewComment(''); 
      setReplyingTo(null); 
      fetchComments();

      // === 核心邏輯：如果不是 Ellery 留言，就觸發變色提醒 ===
      if (currentUser !== 'Ellery') {
        await supabase.from('projects').update({ has_unread: true }).eq('id', project.id);
        if (onStatusChange) onStatusChange(project.id, project.status, true);
      }
    } catch (error) { console.error(error); }
  }

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('確定要刪除這則留言嗎？')) return;
    try {
      await supabase.from('comments').delete().eq('id', commentId);
      fetchComments();
    } catch (error) { alert('刪除留言失敗'); }
  };

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
    } catch (error) { alert('修改留言失敗'); }
  };

  // 加上 setUnread 參數來控制是否要變色
  const updateProjectStatus = async (newStatus, setUnread = false) => {
    try {
      const { error: projectError } = await supabase.from('projects').update({ status: newStatus, has_unread: setUnread }).eq('id', project.id);
      if (projectError) throw projectError;
      if (onStatusChange) onStatusChange(project.id, newStatus, setUnread);
      onClose();
    } catch (error) { alert('更新失敗'); }
  };

  // === 核心邏輯：點擊無誤或需修改時，觸發變色 (傳入 true) ===
  const handleClientApproval = () => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#4ade80', '#3b82f6', '#facc15'] });
    updateProjectStatus('製作錄音稿與學生卷', true);
  };

  const handleNeedsRevision = () => updateProjectStatus('修改題目', true);

  const handleCloseProject = () => {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
    updateProjectStatus('結案', false); // 結案不需要變色提醒
  };

  const handleDeleteProject = async () => {
    if (!window.confirm(`確定要刪除專案「${project.name}」嗎？此動作無法復原！`)) return;
    try {
      await supabase.from('projects').delete().eq('id', project.id);
      if (onProjectDeleted) onProjectDeleted();
      onClose();
    } catch (error) { alert('刪除失敗'); }
  };

  const handleCopyEmail = async () => {
    if (!project.teacher_email) return;
    await navigator.clipboard.writeText(project.teacher_email);
    setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000);
  };

  if (!project) return null;

  const topLevelComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId) => comments.filter(c => c.parent_id === parentId);
  const getAvatarInitial = (name) => {
    if (!name) return '?';
    if (name === '🌟 系統通知') return '🌟';
    return name.charAt(0).toUpperCase();
  };

  const renderCommentContent = (comment) => {
    if (editingCommentId === comment.id) {
      return (
        <div className="mt-1">
          <textarea 
            value={editingContent} 
            onChange={(e) => setEditingContent(e.target.value)}
            className="w-full text-sm p-2 border border-blue-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1"
            rows={2}
          />
          <div className="flex gap-2">
            <button onClick={() => handleSaveEditComment(comment.id)} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-md font-medium hover:bg-blue-700">儲存</button>
            <button onClick={() => setEditingCommentId(null)} className="text-xs bg-gray-200 text-gray-700 px-2.5 py-1 rounded-md font-medium hover:bg-gray-300">取消</button>
          </div>
        </div>
      );
    }
    return <p className="text-sm text-gray-600 whitespace-pre-wrap">{comment.content}</p>;
  };

  const renderCommentActions = (comment, isSystem) => (
    <div className="mt-2 flex items-center gap-1.5">
      <button onClick={() => setReplyingTo(comment)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="回覆">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
      </button>
      {!isSystem && (
        <>
          <button onClick={() => startEditComment(comment)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="修改">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          </button>
          <button onClick={() => handleDeleteComment(comment.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="刪除">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="text-xl font-bold text-gray-800">{project.name}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => { onCopyProject(project); onClose(); }} className="text-sm bg-purple-50 text-purple-600 hover:bg-purple-100 px-4 py-1.5 rounded-lg font-medium transition-colors border border-purple-200">
                複製
              </button>
              <button onClick={() => setIsEditModalOpen(true)} className="text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-1.5 rounded-lg font-medium transition-colors border border-blue-200">
                修改
              </button>
              <button onClick={handleDeleteProject} className="text-sm bg-red-50 text-red-600 hover:bg-red-100 px-4 py-1.5 rounded-lg font-medium transition-colors border border-red-200">
                刪除
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 p-1"><svg className="w-6 h-6 fill-none stroke-currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <div><p className="text-xs text-gray-500 mb-1">當前狀態</p><p className="font-semibold text-blue-700">{project.status}</p></div>
              <div><p className="text-xs text-gray-500 mb-1">審稿截止日</p><p className="font-semibold text-gray-700">{project.deadline || '未設定'}</p></div>
              <div><p className="text-xs text-gray-500 mb-1">考試範圍</p><p className="font-semibold text-gray-700">{project.scope || '未標註'}</p></div>
              <div><p className="text-xs text-gray-500 mb-1">負責業務</p><p className="font-semibold text-gray-700">{project.sales_rep || '未指派'}</p></div>
              <div><p className="text-xs text-gray-500 mb-1">負責業助</p><p className="font-semibold text-gray-700">{project.sales_assistant || '未指派'}</p></div>
              <div><p className="text-xs text-gray-500 mb-1">製作人員</p><p className="font-semibold text-gray-700">{project.production_staff || '未指派'}</p></div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col gap-3 text-sm">
              <div><span className="text-xs text-gray-500 block mb-0.5">閱卷老師</span><span className="font-semibold text-gray-700">{project.teacher_name || '無'}</span></div>
              <div>
                <span className="text-xs text-gray-500 block mb-0.5">老師 Email</span>
                <div onClick={handleCopyEmail} className="group flex items-center gap-2 cursor-pointer w-max">
                  <span className="font-semibold text-blue-600 group-hover:text-blue-800 transition-colors">{project.teacher_email || '無'}</span>
                  {project.teacher_email && <span className="text-xs font-medium bg-blue-100 text-blue-600 px-2 py-0.5 rounded group-hover:bg-blue-200 transition-colors">{emailCopied ? '✅ 已複製' : '📋 複製'}</span>}
                </div>
              </div>
              <div><span className="text-xs text-gray-500 block mb-0.5">聽力題型</span><p className="font-semibold text-gray-700 whitespace-pre-wrap">{project.listening_types || '無'}</p></div>
              <div><span className="text-xs text-gray-500 block mb-0.5">閱讀題型</span><p className="font-semibold text-gray-700 whitespace-pre-wrap">{project.reading_types || '無'}</p></div>
              <div><span className="text-xs text-gray-500 block mb-0.5">注意事項</span><p className="font-semibold text-gray-700 whitespace-pre-wrap">{project.notes || '無'}</p></div>
            </div>

            {project.status === '待老師回覆' && (
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
                <div><p className="font-bold text-gray-800">老師回覆處理</p><p className="text-sm text-gray-500 mt-1">請根據老師的回饋，選擇對應的處理方式。</p></div>
                <div className="flex gap-2">
                  <button onClick={handleNeedsRevision} className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-medium shadow-sm">需修改</button>
                  <button onClick={handleClientApproval} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm flex items-center gap-1">無誤</button>
                </div>
              </div>
            )}

            {['製作錄音稿與學生卷', '待音檔送件'].includes(project.status) && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
                <div>
                  <p className="font-bold text-blue-800">專案結案審查</p>
                  <p className="text-sm text-blue-600 mt-1">目前進度已符合結案規範。若已全數確認完畢，可直接進行結案存檔。</p>
                </div>
                <button onClick={handleCloseProject} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-1">
                  🎉 辦理結案
                </button>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <h3 className="font-bold text-gray-800 border-b pb-2">討論區</h3>
              {loading ? <p className="text-gray-400 text-sm py-4">載入留言中...</p> : topLevelComments.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">目前沒有討論。</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {topLevelComments.map(comment => {
                    const replies = getReplies(comment.id);
                    const isSystem = comment.author === '🌟 系統通知';
                    
                    return (
                      <div key={comment.id} className="flex flex-col gap-2">
                        <div className={`flex gap-3 p-3 rounded-xl border ${isSystem ? 'bg-yellow-50 border-yellow-100' : 'bg-white border-gray-100 shadow-sm'}`}>
                          <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${isSystem ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                            {getAvatarInitial(comment.author)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5">
                              <span className={`font-bold text-sm ${isSystem ? 'text-yellow-800' : 'text-gray-800'}`}>{comment.author}</span>
                              <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString('zh-TW', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                            </div>
                            
                            {renderCommentContent(comment)}
                            {renderCommentActions(comment, isSystem)}
                          </div>
                        </div>

                        {replies.length > 0 && (
                          <div className="flex flex-col gap-2 ml-10 pl-3 border-l-2 border-gray-100">
                            {replies.map(reply => (
                              <div key={reply.id} className="flex gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                                <div className="w-6 h-6 shrink-0 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                  {getAvatarInitial(reply.author)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-baseline mb-0.5">
                                    <span className="font-bold text-xs text-gray-700">{reply.author}</span>
                                    <span className="text-[10px] text-gray-400">{new Date(reply.created_at).toLocaleString('zh-TW', { hour:'2-digit', minute:'2-digit' })}</span>
                                  </div>
                                  
                                  {renderCommentContent(reply)}
                                  {renderCommentActions(reply, false)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 bg-white flex flex-col gap-2">
            {replyingTo && (
              <div className="flex items-center justify-between bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-lg border border-blue-100">
                <span className="truncate">正在回覆 <strong>{replyingTo.author}</strong> : {replyingTo.content}</span>
                <button onClick={() => setReplyingTo(null)} className="ml-2 font-bold hover:text-blue-900">&times;</button>
              </div>
            )}

            <div className="flex gap-2">
              <select value={currentUser} onChange={handleUserChange} className="w-[110px] px-2 py-2 border border-gray-200 rounded-lg outline-none text-sm font-medium text-gray-700 bg-gray-50 shrink-0">
                {TEAM_MEMBERS.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} placeholder={replyingTo ? "輸入回覆..." : "新增討論..."} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg outline-none text-sm" />
              <button onClick={handleAddComment} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">送出</button>
            </div>
          </div>

        </div>
      </div>

      <EditProjectModal isOpen={isEditModalOpen} project={project} onClose={() => setIsEditModalOpen(false)} onProjectUpdated={() => { if (onProjectUpdated) onProjectUpdated(); }} />
    </>
  );
}