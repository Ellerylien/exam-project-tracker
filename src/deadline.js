// 死線狀態的共用邏輯：看板、業務儀表板共用同一套文字與顏色，
// 顏色對應 index.css @theme 的 danger / warning / info 狀態色
function getDiffDays(deadline) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(deadline); target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

// level: 'closed' | 'none' | 'overdue' | 'today' | 'soon' | 'normal'
export function getDeadlineInfo(deadline, status) {
  if (status === '結案') return { text: '已結案', level: 'closed', color: 'bg-paper-soft text-ink-muted border-transparent' };
  if (!deadline) return { text: '未設定期限', level: 'none', color: 'bg-paper-soft text-ink-muted border-transparent' };

  const diffDays = getDiffDays(deadline);

  if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, level: 'overdue', color: 'bg-danger-bg text-danger border-danger-line/40' };
  if (diffDays === 0) return { text: '今天截稿', level: 'today', color: 'bg-danger-bg text-danger border-danger-line/40' };
  if (diffDays <= 3) return { text: `${diffDays} 天後截稿`, level: 'soon', color: 'bg-warning-bg text-warning border-warning-line/40' };
  return { text: `${diffDays} 天後`, level: 'normal', color: 'bg-info-bg text-info border-info-line/40' };
}

export function isUrgent(deadline, status) {
  if (status === '結案' || !deadline) return false;
  return getDiffDays(deadline) <= 3;
}
