-- Create Bulletin Board Table
create table if not exists bulletins (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table bulletins enable row level security;

-- Policies (Adjust as needed, currently allowing full access to authenticated users for simplicity, or refine for public read/admin write)
create policy "Allow all for authenticated users" on bulletins for all using (true) with check (true);
