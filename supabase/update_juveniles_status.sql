-- Add status column to juveniles table
ALTER TABLE juveniles ADD COLUMN IF NOT EXISTS status text DEFAULT '服務中';

-- Add check constraint for status options
ALTER TABLE juveniles DROP CONSTRAINT IF EXISTS juveniles_status_check;
ALTER TABLE juveniles ADD CONSTRAINT juveniles_status_check CHECK (status IN ('服務中', '已結案'));
