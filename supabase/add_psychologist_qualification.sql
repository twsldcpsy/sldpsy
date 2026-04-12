-- Add qualification column to psychologists table
-- User request: "在姓名與登入密碼間新增一個資料類型，「身分別」"
-- Options: '諮商心理師', '臨床心理師', '醫師'

alter table psychologists 
  add column if not exists qualification text check (qualification in ('諮商心理師', '臨床心理師', '醫師'));

-- Update existing records to have a default value if needed (optional, or leave null)
-- update psychologists set qualification = '諮商心理師' where qualification is null;
