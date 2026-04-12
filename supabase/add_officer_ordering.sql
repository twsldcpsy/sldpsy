-- Add display_order column
ALTER TABLE probation_officers ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Update the View RPC
DROP FUNCTION IF EXISTS get_admin_view_officers();

CREATE OR REPLACE FUNCTION get_admin_view_officers()
RETURNS TABLE (
  id uuid,
  name text,
  department text,
  role text,
  password text,
  contact_info text,
  extension_number text,
  created_at timestamptz,
  display_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.department, p.role, p.password, p.contact_info, p.extension_number, p.created_at, p.display_order
  FROM probation_officers p
  ORDER BY p.display_order ASC, p.created_at DESC;
END;
$$;

-- Update Create RPC
CREATE OR REPLACE FUNCTION admin_create_officer(
    o_name text,
    o_department text,
    o_role text,
    o_password text,
    o_contact_info text,
    o_extension_number text,
    o_display_order integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id uuid;
BEGIN
    INSERT INTO probation_officers (name, department, role, password, contact_info, extension_number, display_order)
    VALUES (o_name, o_department, o_role, o_password, o_contact_info, o_extension_number, o_display_order)
    RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$;

-- Update Update RPC
CREATE OR REPLACE FUNCTION admin_update_officer(
    target_id uuid,
    o_name text,
    o_department text,
    o_role text,
    o_contact_info text,
    o_extension_number text,
    o_display_order integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE probation_officers 
    SET 
        name = o_name, 
        department = o_department, 
        role = o_role, 
        contact_info = o_contact_info,
        extension_number = o_extension_number,
        display_order = o_display_order
    WHERE id = target_id;
    RETURN true;
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION get_admin_view_officers() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_officer(text, text, text, text, text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_update_officer(uuid, text, text, text, text, text, integer) TO anon, authenticated;
