-- Secure Password Management Functions

-- 1. Psychologist Self-Service Password Change
CREATE OR REPLACE FUNCTION change_own_password_psychologist(old_password text, new_password text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify old password and ID match
  IF EXISTS (
    SELECT 1 FROM psychologists 
    WHERE id = p_id AND password = old_password
  ) THEN
    -- Update password
    UPDATE psychologists 
    SET password = new_password 
    WHERE id = p_id;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- 2. Probation Officer Self-Service Password Change
CREATE OR REPLACE FUNCTION change_own_password_officer(old_password text, new_password text, o_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify old password and ID match
  IF EXISTS (
    SELECT 1 FROM probation_officers 
    WHERE id = o_id AND password = old_password
  ) THEN
    -- Update password
    UPDATE probation_officers 
    SET password = new_password 
    WHERE id = o_id;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- 3. Admin Reset Password for Psychologist
CREATE OR REPLACE FUNCTION admin_reset_password_psychologist(target_id uuid, new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE psychologists 
    SET password = new_password 
    WHERE id = target_id;
    RETURN true;
END;
$$;

-- 4. Admin Reset Password for Probation Officer
CREATE OR REPLACE FUNCTION admin_reset_password_officer(target_id uuid, new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE probation_officers 
    SET password = new_password 
    WHERE id = target_id;
    RETURN true;
END;
$$;

-- Grant Execute Permissions
GRANT EXECUTE ON FUNCTION change_own_password_psychologist(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION change_own_password_officer(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_password_psychologist(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_password_officer(uuid, text) TO anon, authenticated;

-- 5. Admin View All Psychologists (Includes Password)
CREATE OR REPLACE FUNCTION get_admin_view_psychologists()
RETURNS TABLE (
  id uuid,
  name text,
  qualification text,
  password text,
  contact_info text,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.qualification, p.password, p.contact_info, p.is_active, p.created_at
  FROM psychologists p
  ORDER BY p.created_at DESC;
END;
$$;

-- 6. Admin View All Probation Officers (Includes Password)
CREATE OR REPLACE FUNCTION get_admin_view_officers()
RETURNS TABLE (
  id uuid,
  name text,
  department text,
  role text,
  password text,
  contact_info text,
  extension_number text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.department, p.role, p.password, p.contact_info, p.extension_number, p.created_at
  FROM probation_officers p
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_view_psychologists() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_view_officers() TO anon, authenticated;
