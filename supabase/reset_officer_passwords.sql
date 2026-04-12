-- Reset all probation officer passwords to '28312321'
UPDATE probation_officers SET password = '28312321';

-- Set the default value for future inserts
ALTER TABLE probation_officers ALTER COLUMN password SET DEFAULT '28312321';
