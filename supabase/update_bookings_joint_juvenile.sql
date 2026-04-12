-- Add includes_juvenile column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS includes_juvenile boolean DEFAULT false;

-- Comment for documentation
COMMENT ON COLUMN bookings.includes_juvenile IS 'For Joint counseling: whether the juvenile is included in the session';
