-- ============================================================
-- Exam Tracker — 成員聯絡資料（寄信範本用）
-- 貼進 Supabase 主控台 → SQL Editor → Run(可重複執行)
--
-- 專案詳情的「寄信」按鈕會用這些欄位帶入收件人／副本與信件內文:
--   email      收件人／副本地址
--   full_name  英文全名,錄音稿信件的署名(如 Ellery Lien)
--   zh_name    中文姓名,請閱卷信件的「請與○○○專員聯絡」
-- api/users.js 會把這三欄(不含 PIN)一起回傳給前端。
-- ============================================================

alter table public.team_users
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists zh_name text;

-- 填資料範例(依實際人員修改後執行):
-- update public.team_users set email = 'someone@example.com', full_name = 'Deborah Hsu', zh_name = '許文瑜' where name = 'Deborah';
