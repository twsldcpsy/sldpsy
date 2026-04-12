-- Secure Login Functions & Permissions Setup

-- 1. Create Psychologist Login Verification Function
CREATE OR REPLACE FUNCTION verify_psychologist_login(input_id uuid, input_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (admin), bypassing RLS
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM psychologists 
    WHERE id = input_id 
      AND password = input_password 
      AND is_active = true
  );
END;
$$;

-- 2. Create Probation Officer Login Verification Function
CREATE OR REPLACE FUNCTION verify_probation_login(input_department text, input_password text)
RETURNS TABLE (
  id uuid,
  name text,
  department text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.department, p.role
  FROM probation_officers p
  WHERE p.department = input_department 
    AND p.password = input_password
  LIMIT 1;
END;
$$;

-- 3. Revoke direct access to password columns (Security Hardening)
-- First, ensure RLS is enabled
ALTER TABLE psychologists ENABLE ROW LEVEL SECURITY;
ALTER TABLE probation_officers ENABLE ROW LEVEL SECURITY;

-- Remove existing broad policies if they expose passwords (safest way is to define explicit new ones)
-- Note: You might need to drop existing policies first if they conflict, but let's try to restrict column access via Grant/Revoke first if using Postgres roles, 
-- OR strictly define RLS policies that don't include password.

-- Since Supabase exposes via API, the best way for anon/authenticated users is to NOT grant SELECT on the password column at all.
-- However, Supabase permissions are usually table-level. Column-level permissions are possible but tricky in Supabase UI.
-- A robust RLS policy is usually preferred.

-- Create Policy for Psychologists: Public can see names (for dropdown), but NOT passwords.
-- DROP POLICY IF EXISTS "Public read access" ON psychologists;
-- CREATE POLICY "Public read access" ON psychologists FOR SELECT USING (true); 
-- ^ This exposes everything. We need to be careful.

-- STRATEGY: We cannot easily "hide" a column via RLS in standard SQL without views. 
-- BUT we can revoke permissions for the 'anon' and 'authenticated' roles on the specific column.

REVOKE SELECT(password) ON psychologists FROM anon, authenticated;
REVOKE SELECT(password) ON probation_officers FROM anon, authenticated;

-- Grant access to other columns explicitly if needed, or rely on table level grant + column level revoke? 
-- Postgres doesn't support "REVOKE SELECT(column)". It supports "GRANT SELECT(column)".
-- So we must revoke TABLE level select, and then GRANT specific columns.

REVOKE SELECT ON psychologists FROM anon, authenticated;
GRANT SELECT (id, name, is_active, contact_info) ON psychologists TO anon, authenticated;

REVOKE SELECT ON probation_officers FROM anon, authenticated;
GRANT SELECT (id, name, department, role, contact_info, extension_number) ON probation_officers TO anon, authenticated;

-- Grant EXECUTE on the new functions
GRANT EXECUTE ON FUNCTION verify_psychologist_login(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_probation_login(text, text) TO anon, authenticated;
