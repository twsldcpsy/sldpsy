-- Add psychologist and department columns to juveniles table
alter table juveniles 
  add column if not exists psychologist_id uuid references psychologists(id),
  add column if not exists department_id uuid references departments(id);

-- Make case_number unique if not already (good practice)
-- alter table juveniles add constraint juveniles_case_number_key unique (case_number);
