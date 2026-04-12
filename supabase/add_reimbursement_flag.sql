-- Add is_verified column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- Update RLS if necessary (usually * covers new columns, but sometimes explicit grant needed if strict)
-- In this project, RLS is active but typical select * works if policy allows row access.
-- No extra policy changes needed for just a column unless we want to restrict who can see it.
-- Assuming Admin/Manager can see/edit.
