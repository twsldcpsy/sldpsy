-- Add room_number to bookings table
-- Options: 201, 202, 203, 204, 205, 206, 207, 208

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_number text;

-- Add a check constraint for room numbers if desired, but text is strictly requested as options so we will handle it in UI or check here.
-- ALTER TABLE bookings ADD CONSTRAINT bookings_room_number_check CHECK (room_number IN ('201', '202', '203', '204', '205', '206', '207', '208'));
