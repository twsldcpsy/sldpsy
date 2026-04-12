-- Emergency fix: Drop the strict status check constraint to allow data entry
-- The Dropdown menu in the UI will still enforce valid options for the user.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Ensure the column exists and has the correct default
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT '尚未開始';
