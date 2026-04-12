-- Add password and contact_info columns to psychologists table
-- Replacing "email" usage with "password" for login in the UI, but keeping email in DB just in case, 
-- or we can just leave email as is. 
-- User request: "在心理師資料庫中將email/帳號改為「登入密碼」，並新增聯繫方式欄位"

alter table psychologists 
  add column if not exists password text,
  add column if not exists contact_info text;

-- Update existing records to have a default password if null
update psychologists set password = 'password123' where password is null;
