-- Enable RLS for bookings table
alter table bookings enable row level security;

-- Policy for Public Read (or Authenticated) - Simplifying for dev
create policy "Allow all access to bookings" on bookings for all using (true) with check (true);
