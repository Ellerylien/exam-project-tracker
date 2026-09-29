-- ============================================================
-- Exam Tracker — 手機／瀏覽器推播（Web Push）的訂閱資料
-- 貼進 Supabase 主控台 → SQL Editor → Run(可重複執行)
--
-- 每台裝置按「開啟手機通知」後，瀏覽器會給一組訂閱資料
-- (endpoint + 金鑰),由 api/push-subscribe.js 存進這張表;
-- api/notify.js 有新留言或進度變更時,依 user_name 找出該案
-- 業務、業助、製作人員的所有裝置送推播。
--
-- 只有後端 service_role 會碰這張表:開 RLS、不建任何 policy,
-- 公開的 anon key 讀不到也寫不到(同 team_users 的做法)。
-- ============================================================

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_name text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_name_idx
  on public.push_subscriptions (user_name);

alter table public.push_subscriptions enable row level security;
-- (此表刻意不建立任何 policy)
