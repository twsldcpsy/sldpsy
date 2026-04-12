-- 1. Enable RLS (already enabled, but just in case)
alter table juveniles enable row level security;

-- 2. Add Policy for Public Access (For development speed, refine later)
create policy "Enable read access for all users" on juveniles for select using (true);
create policy "Enable insert for all users" on juveniles for insert with check (true);
create policy "Enable update for all users" on juveniles for update using (true);

-- 3. Add Seed Data (so the list isn't empty)
-- Need to get valid department and psychologist IDs preferably, but can insert nulls or subqueries
do $$
declare
  dept_id uuid;
  psych_id uuid;
begin
  -- Try to find existing IDs
  select id into dept_id from departments limit 1;
  select id into psych_id from psychologists limit 1;

  if dept_id is not null then
    insert into juveniles (name, case_number, gender, department_id, psychologist_id)
    values 
      ('測試少年A', '113-少調-001', 'Male', dept_id, psych_id),
      ('測試少年B', '113-少保-002', 'Female', dept_id, psych_id);
  end if;
end $$;
