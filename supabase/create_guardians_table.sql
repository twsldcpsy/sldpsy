create table if not exists guardians (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  juvenile_name text,
  case_number text,
  case_type text default '強制親職教育',
  status text default '服務中',
  closure_reason text,
  probation_officer_id uuid references probation_officers(id),
  psychologist_id uuid references psychologists(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table guardians add column if not exists juvenile_name text;
alter table guardians add column if not exists case_type text default '強制親職教育';
alter table guardians add column if not exists status text default '服務中';
alter table guardians add column if not exists closure_reason text;

alter table guardians drop constraint if exists guardians_case_type_check;
alter table guardians add constraint guardians_case_type_check
  check (case_type in ('強制親職教育'));

alter table guardians drop constraint if exists guardians_status_check;
alter table guardians add constraint guardians_status_check
  check (status in ('服務中', '已結案'));

alter table guardians drop constraint if exists guardians_closure_reason_check;
alter table guardians add constraint guardians_closure_reason_check
  check (closure_reason is null or closure_reason in ('期滿', '處分轉換', '已無需求', '更換心理師'));

alter table guardians enable row level security;

drop policy if exists "Enable read access for all users" on guardians;
create policy "Enable read access for all users" on guardians for select using (true);

drop policy if exists "Enable insert for all users" on guardians;
create policy "Enable insert for all users" on guardians for insert with check (true);

drop policy if exists "Enable update for all users" on guardians;
create policy "Enable update for all users" on guardians for update using (true);

drop policy if exists "Enable delete for all users" on guardians;
create policy "Enable delete for all users" on guardians for delete using (true);
