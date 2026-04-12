-- Refactor: Switch from department_id (FK) to department (Text)
-- This allows free text input for "股別" as requested.

-- 1. Add new text column
ALTER TABLE probation_officers ADD COLUMN IF NOT EXISTS department text;

-- 2. Migrate data from existing department links
UPDATE probation_officers po
SET department = d.name
FROM departments d
WHERE po.department_id = d.id;

-- 3. Validation/Cleanup (Optional: we keep department_id for now as backup, but UI will use 'department')
-- ALTER TABLE probation_officers DROP COLUMN department_id;
