-- Ensure counseling detail columns exist
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS individual_subject text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS joint_attendees_count integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS joint_details text;

-- Optional: Drop existing check constraints if we want to allow Chinese values directly, 
-- or we will handle mapping in frontend. 
-- For safety, let's remove the constraint on individual_subject if it exists to allow flexibility.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_individual_subject_check;
