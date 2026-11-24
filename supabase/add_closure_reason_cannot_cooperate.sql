-- 結案原因新增「無法配合」
-- 只放寬 CHECK 限制（多允許一個值），不更動任何既有資料；可重複執行。
-- 上線順序：先執行本 SQL，再部署前端。

ALTER TABLE juveniles DROP CONSTRAINT IF EXISTS juveniles_closure_reason_check;
ALTER TABLE juveniles ADD CONSTRAINT juveniles_closure_reason_check
  CHECK (closure_reason IS NULL OR closure_reason IN ('期滿', '處分轉換', '已無需求', '更換心理師', '無法配合'));

ALTER TABLE guardians DROP CONSTRAINT IF EXISTS guardians_closure_reason_check;
ALTER TABLE guardians ADD CONSTRAINT guardians_closure_reason_check
  CHECK (closure_reason IS NULL OR closure_reason IN ('期滿', '處分轉換', '已無需求', '更換心理師', '無法配合'));
