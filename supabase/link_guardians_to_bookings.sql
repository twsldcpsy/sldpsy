alter table bookings add column if not exists guardian_id uuid references guardians(id);
alter table bookings add column if not exists juvenile_name text;
