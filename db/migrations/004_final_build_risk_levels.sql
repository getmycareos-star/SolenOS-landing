-- Final build: canonical lowercase risk levels (legacy uppercase accepted at boundary)
ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_risk_level_check;
ALTER TABLE interactions ADD CONSTRAINT interactions_risk_level_check
  CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'low', 'medium', 'high', 'critical'));
