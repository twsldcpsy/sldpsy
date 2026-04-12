-- Functions to allow Psychologists to manage their own profile (bypassing RLS for Anon user)

-- 1. Get Profile Details
CREATE OR REPLACE FUNCTION get_psychologist_profile_self(p_id uuid)
RETURNS TABLE (
  name text,
  qualification text,
  contact_info text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.name, p.qualification, p.contact_info
  FROM psychologists p
  WHERE p.id = p_id;
END;
$$;

-- 2. Update Profile Details
CREATE OR REPLACE FUNCTION update_psychologist_profile_self(p_id uuid, p_name text, p_qualification text, p_contact_info text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE psychologists
  SET 
    name = p_name,
    qualification = p_qualification,
    contact_info = p_contact_info
  WHERE id = p_id;
  
  RETURN true;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_psychologist_profile_self(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_psychologist_profile_self(uuid, text, text, text) TO anon, authenticated;
