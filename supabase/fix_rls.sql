-- FIX: Enable public read access for tables used in public login pages
-- Run this in your Supabase SQL Editor

-- 1. Policies for Psychologists (Blocked by RLS default)
create policy "Public read access" on psychologists for select using (true);

-- 2. Ensure Departments is accessible (if you decide to enable RLS later)
alter table departments enable row level security;
create policy "Public read access" on departments for select using (true);

-- 3. Probation Officers (For checking roles after login)
create policy "Public read access" on probation_officers for select using (true);
