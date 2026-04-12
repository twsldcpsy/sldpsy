-- FIX: Enable full CRUD access for psychologists table
-- This is necessary because the previous RLS policies only allowed SELECT (read-only).

-- 1. Enable RLS (already enabled, but good to be sure)
alter table psychologists enable row level security;

-- 2. Add Policies for Insert, Update, Delete
-- Note: 'read access' was likely added in fix_rls.sql, but we can re-declare or add if missing.
-- If "Public read access" exists, we just need the others.

create policy "Enable insert for all users" on psychologists for insert with check (true);
create policy "Enable update for all users" on psychologists for update using (true);
create policy "Enable delete for all users" on psychologists for delete using (true);

-- 3. Also fix Juveniles DELETE policy (Update/Insert were added in fix_juvenile_data.sql)
create policy "Enable delete for all users" on juveniles for delete using (true);
