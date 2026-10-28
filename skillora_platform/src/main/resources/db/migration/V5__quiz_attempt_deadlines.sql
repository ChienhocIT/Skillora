ALTER TABLE quiz_attempts ADD COLUMN deadline_at DATETIME(6) NULL;
ALTER TABLE quiz_attempts
    MODIFY COLUMN started_at DATETIME(6) NOT NULL,
    MODIFY COLUMN submitted_at DATETIME(6) NULL;
