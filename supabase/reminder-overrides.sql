-- ============================================================
-- Exam Tracker — 待申請提醒的例外記錄
-- 貼進 Supabase 主控台 → SQL Editor → Run(可重複執行)
--
-- 「待申請提醒」由前端依已申請的案件即時推算(src/reminders.js),
-- 推算結果本身不存資料庫。這張表只記業務手動做的「例外」:
--   skip         只略過某一次(例:學校第三次段考不考聽力)
--   end_term     某學期到此為止(exam_no = 第一個不考的次數)
--   stop_series  整個系列停止提醒(例:不再合作)
--   applied      從提醒建立了申請,但名稱與推算對不上,仍視為已申請
--   manual       手動新增的提醒(推算不出來的案件,如開學考、單字比賽)
-- name 存建立當下的顯示文字,「已略過」清單與手動提醒直接顯示它。
-- ============================================================

create table if not exists public.reminder_overrides (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('skip', 'end_term', 'stop_series', 'applied', 'manual')),
  series_key text,
  school_year int,
  term text check (term in ('上', '下')),
  exam_no int,
  name text,
  sales_rep text,
  created_by text,
  created_at timestamptz not null default now()
);

-- 與 projects 相同:前端用 anon key 直接 CRUD(背景說明見 enable-rls.sql)
alter table public.reminder_overrides enable row level security;

drop policy if exists "app full access on reminder_overrides" on public.reminder_overrides;
create policy "app full access on reminder_overrides"
  on public.reminder_overrides
  for all
  to anon, authenticated
  using (true)
  with check (true);
