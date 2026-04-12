-- Create a function to get juveniles with their officer's department
-- This avoids frontend joining issues and bypasses RLS on officers table if needed

CREATE OR REPLACE FUNCTION get_juveniles_with_department()
RETURNS TABLE (
  id uuid,
  name text,
  gender text,
  case_type text,
  probation_officer_id uuid,
  department text
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with admin privileges to guarantee access to matching officer data
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.name,
    j.gender,
    j.case_number, -- We map case_number to case_type for now if needed, or just return as is. 
    -- distinct columns
    j.probation_officer_id,
    COALESCE(p.department, '未分股') as department
  FROM juveniles j
  LEFT JOIN probation_officers p ON j.probation_officer_id = p.id
  ORDER BY j.name;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_juveniles_with_department() TO anon, authenticated;
