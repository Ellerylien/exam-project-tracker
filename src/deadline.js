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

// 只有排隊區、出題中還沒交件，需要看審稿倒數；其餘進度已交件，倒數不再有意義
export const COUNTDOWN_STATUSES = ['排隊區', '出題中'];

// 看板與業務分區共用：交件後、結案前改顯示「已交件」，不再倒數或亮逾期
export function getHandoffDeadlineInfo(deadline, status) {
  if (status !== '結案' && !COUNTDOWN_STATUSES.includes(status)) {
    return { text: '已交件', level: 'delivered', color: 'bg-paper-soft text-ink-muted border-transparent' };
  }
  return getDeadlineInfo(deadline, status);
}
