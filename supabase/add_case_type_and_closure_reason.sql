-- Add case_type and closure_reason columns to juveniles table

ALTER TABLE juveniles ADD COLUMN IF NOT EXISTS case_type text DEFAULT '保護管束';
ALTER TABLE juveniles DROP CONSTRAINT IF EXISTS juveniles_case_type_check;
ALTER TABLE juveniles ADD CONSTRAINT juveniles_case_type_check CHECK (case_type IN ('調查', '保護管束', '假日生活輔導'));

ALTER TABLE juveniles ADD COLUMN IF NOT EXISTS closure_reason text;
ALTER TABLE juveniles DROP CONSTRAINT IF EXISTS juveniles_closure_reason_check;
ALTER TABLE juveniles ADD CONSTRAINT juveniles_closure_reason_check CHECK (closure_reason IS NULL OR closure_reason IN ('期滿', '處分轉換', '已無需求', '更換心理師'));
