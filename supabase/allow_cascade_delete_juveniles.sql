-- Enable CASCADE DELETE for juveniles in the bookings table

-- 1. Drop the existing foreign key constraint (the name is usually bookings_juvenile_id_fkey)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_juvenile_id_fkey;

-- 2. Add the new foreign key constraint with ON DELETE CASCADE
ALTER TABLE bookings
  ADD CONSTRAINT bookings_juvenile_id_fkey
  FOREIGN KEY (juvenile_id)
  REFERENCES juveniles(id)
  ON DELETE CASCADE;
