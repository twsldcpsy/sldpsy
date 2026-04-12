-- Fix invalid status values before applying constraint
-- Update any rows with NULL or invalid status to '尚未開始'
UPDATE bookings 
SET status = '尚未開始' 
WHERE status IS NULL OR status NOT IN ('尚未開始', '缺席', '等待報告', '完成');

-- Drop existing constraint if it exists (just in case)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Add new constraint
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
CHECK (status IN ('尚未開始', '缺席', '等待報告', '完成'));

-- Set default value
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT '尚未開始';
