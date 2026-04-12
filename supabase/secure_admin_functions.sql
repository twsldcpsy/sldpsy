-- Admin Management Functions (CRUD)
-- These functions run with SECURITY DEFINER to bypass RLS/Column restrictions for Admins

-- 1. Create Psychologist
CREATE OR REPLACE FUNCTION admin_create_psychologist(
    p_name text,
    p_qualification text,
    p_password text,
    p_contact_info text,
    p_is_active boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO psychologists (name, qualification, password, contact_info, is_active)
    VALUES (p_name, p_qualification, p_password, p_contact_info, p_is_active);
    RETURN true;
END;
$$;

-- 2. Update Psychologist
CREATE OR REPLACE FUNCTION admin_update_psychologist(
    target_id uuid,
    p_name text,
    p_qualification text,
    p_contact_info text,
    p_is_active boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE psychologists
    SET 
        name = p_name,
        qualification = p_qualification,
        contact_info = p_contact_info,
        is_active = p_is_active
    WHERE id = target_id;
    RETURN true;
END;
$$;

-- 3. Delete Psychologist
CREATE OR REPLACE FUNCTION admin_delete_psychologist(target_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM psychologists WHERE id = target_id;
    RETURN true;
END;
$$;


-- 4. Create Probation Officer
CREATE OR REPLACE FUNCTION admin_create_officer(
    o_name text,
    o_department text,
    o_role text,
    o_password text,
    o_contact_info text,
    o_extension_number text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO probation_officers (name, department, role, password, contact_info, extension_number)
    VALUES (o_name, o_department, o_role, o_password, o_contact_info, o_extension_number);
    RETURN true;
END;
$$;

-- 5. Update Probation Officer
CREATE OR REPLACE FUNCTION admin_update_officer(
    target_id uuid,
    o_name text,
    o_department text,
    o_role text,
    o_contact_info text,
    o_extension_number text
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
        extension_number = o_extension_number
    WHERE id = target_id;
    RETURN true;
END;
$$;

-- 6. Delete Probation Officer
CREATE OR REPLACE FUNCTION admin_delete_officer(target_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM probation_officers WHERE id = target_id;
    RETURN true;
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION admin_create_psychologist(text, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_update_psychologist(uuid, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_psychologist(uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION admin_create_officer(text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_update_officer(uuid, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_officer(uuid) TO anon, authenticated;
