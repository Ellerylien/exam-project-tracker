-- ============================================================
-- Exam Tracker — 留言 @提及（tag 人員）
-- 貼進 Supabase 主控台 → SQL Editor → Run(可重複執行)
--
-- 留言時輸入 @名字 選取成員,送出時把被提到的人存進 mentions;
-- api/notify.js 會另外推手機通知給這些人(即使他沒掛名在該案件),
-- 討論串也依 mentions 標示 @名字。
-- ============================================================

alter table public.comments
  add column if not exists mentions text[] not null default '{}';
