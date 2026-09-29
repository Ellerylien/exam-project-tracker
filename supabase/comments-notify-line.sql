-- ============================================================
-- Exam Tracker — 留言可選擇是否推播到 LINE
-- 貼進 Supabase 主控台 → SQL Editor → Run(可重複執行)
--
-- LINE 官方帳號輕用量每月只有 200 則,推到群組時依群組人數計則數,
-- 每則留言都推會很快用完額度。改成留言時勾選「同步通知 LINE」
-- 才推播(api/notify.js 只推 notify_line = true 的留言)。
-- 預設 false:一般討論只留在系統內,不佔額度。
-- ============================================================

alter table public.comments
  add column if not exists notify_line boolean not null default false;
