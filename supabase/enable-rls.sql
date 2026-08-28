-- ============================================================
-- Exam Tracker — 啟用 RLS
-- 貼進 Supabase 主控台 → SQL Editor → Run(可重複執行)
--
-- 背景:本專案使用自製 PIN 登入(非 Supabase Auth),前端以公開的
-- anon key 直接對 projects/comments 做 CRUD。資料庫無法區分「登入者」
-- 與「陌生人」(兩者都是同一個 anon 角色),因此 projects/comments 採
-- 全放行 policy:可消除 Supabase 警告、維持功能,但不構成實質存取控制。
-- 真正的安全收穫在 team_users —— 鎖死後公開金鑰再也讀不到 PIN 雜湊。
-- ============================================================

-- ── 1) team_users:只有後端 service_role 會碰它 ──────────────
-- 開 RLS、但「不建任何 policy」= 公開的 anon key 完全讀不到/寫不到。
-- api/login.js、api/users.js 用 service_role,會繞過 RLS,照常運作。
-- 前端從不直接查 team_users,所以這步零風險,卻關掉最嚴重的洞
-- (否則陌生人可直接讀走全體使用者與 4 位數 PIN 的 bcrypt 雜湊並離線爆破)。
alter table public.team_users enable row level security;
-- (此表刻意不建立任何 policy)

-- ── 2) projects:前端用 anon key 直接 CRUD ──────────────────
-- 開 RLS,並對 anon/authenticated 開放完整 CRUD,
-- 維持現有讀寫刪與 Realtime 即時同步功能不變。
alter table public.projects enable row level security;

drop policy if exists "app full access on projects" on public.projects;
create policy "app full access on projects"
  on public.projects
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ── 3) comments:同上 ───────────────────────────────────────
alter table public.comments enable row level security;

drop policy if exists "app full access on comments" on public.comments;
create policy "app full access on comments"
  on public.comments
  for all
  to anon, authenticated
  using (true)
  with check (true);
