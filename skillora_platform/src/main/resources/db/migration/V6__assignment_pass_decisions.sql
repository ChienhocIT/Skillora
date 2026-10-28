-- Existing grades need explicit instructor confirmation; do not infer pass from a numeric score.
ALTER TABLE assignment_submissions ADD COLUMN passed TINYINT(1) NULL;
