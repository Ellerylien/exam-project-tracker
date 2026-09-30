// 團隊成員清單（留言 @提及選單用），整個 App 共用同一次請求。
// 來源是 api/users.js（只有 id / name / role），訪客不列入。
let membersPromise = null;

export function loadTeamMembers() {
  membersPromise ??= fetch('/api/users')
    .then(r => r.json())
    .then(data => (data.users || []).filter(u => (u.role || '').toLowerCase() !== 'guest'))
    .catch(() => { membersPromise = null; return []; });
  return membersPromise;
}

const ROLE_LABELS = { sales: '業務', assistant: '業助', admin: '管理者' };
export const roleLabel = (role) => ROLE_LABELS[(role || '').toLowerCase()] ?? '';

// 留言文字裡的 @名字 → 被提到的成員名單（只認得清單裡的名字）
export function extractMentions(text, names) {
  return names.filter(name => new RegExp(`@${escapeRegExp(name)}(?![A-Za-z0-9_])`).test(text));
}

export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
