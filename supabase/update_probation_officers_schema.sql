-- Add columns to probation_officers table
-- Fields: password, contact_info, extension_number

alter table probation_officers 
  add column if not exists password text default 'password123',
  add column if not exists contact_info text,
  add column if not exists extension_number text;

-- Ensure RLS allows Insert/Update/Delete (Use the same broad policy as Psychologists for now)
alter table probation_officers enable row level security;
create policy "Enable full access for all users" on probation_officers for all using (true) with check (true);
