-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Departments / Groups (for Probation Officers)
create table departments (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Psychologists
create table psychologists (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique, -- Optional if using Auth
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Probation Officers (Users)
create table probation_officers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  department_id uuid references departments(id),
  role text check (role in ('general', 'manager', 'admin')) default 'general',
  email text unique, -- Optional if using Auth
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Juveniles (The subjects)
create table juveniles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  gender text check (gender in ('Male', 'Female', 'Other')),
  birth_date date,
  case_number text,
  probation_officer_id uuid references probation_officers(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Bookings
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  psychologist_id uuid references psychologists(id) not null,
  juvenile_id uuid references juveniles(id), -- Can be null if generic? Assuming linked to juvenile.
  
  -- Booking Details
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer,
  location text,
  
  -- Counseling Type Logic
  counseling_type text check (counseling_type in ('Individual', 'Joint', 'Consultation')),
  -- If Individual: Subject is usually the juvenile or parent
  individual_subject text check (individual_subject in ('Juvenile', 'Parent', 'Other')),
  -- If Joint:
  joint_attendees_count integer,
  joint_details text,
  
  notes text,
  status text check (status in ('Pending', 'Confirmed', 'Completed', 'Cancelled')) default 'Pending',
  
  created_by uuid, -- ID of the user who created it
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) - Placeholder policies
-- In a real app, you would enable RLS and link these to auth.uid()

alter table bookings enable row level security;
alter table juveniles enable row level security;
alter table psychologists enable row level security;
alter table probation_officers enable row level security;

-- Seed Data (For Development)
insert into departments (name) values ('少年調查官'), ('少年保護官'), ('行政相關');

insert into psychologists (name) values ('張心理師'), ('王心理師'), ('李心理師');
