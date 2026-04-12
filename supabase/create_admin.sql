-- Create System Admin Department and User
-- Run this in Supabase SQL Editor

-- 1. Ensure 'System Admin' department exists
INSERT INTO departments (name)
VALUES ('系統管理員')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert the Admin User
-- Note: Authentication is currently simulated via the Dropdown + Password Check in frontend.
-- This inserts the user into the database so they appear in the list.
INSERT INTO probation_officers (name, department_id, role)
SELECT 
    '系統管理員', 
    id, 
    'admin'
FROM departments 
WHERE name = '系統管理員'
-- Avoid duplicates
AND NOT EXISTS (
    SELECT 1 FROM probation_officers WHERE name = '系統管理員'
);
