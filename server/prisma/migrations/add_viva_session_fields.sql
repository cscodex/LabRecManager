-- Add new fields for viva session timing and recording
-- Run this in Neon SQL Editor

-- Add scheduling fields
ALTER TABLE viva_sessions
ADD COLUMN IF NOT EXISTS scheduled_end_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_start BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_admit BOOLEAN DEFAULT true;

-- Add recording fields  
ALTER TABLE viva_sessions
ADD COLUMN IF NOT EXISTS recording_file_path TEXT,
ADD COLUMN IF NOT EXISTS recording_size_bytes INTEGER,
ADD COLUMN IF NOT EXISTS recording_duration_seconds INTEGER;

-- Create index for auto-start queries
CREATE INDEX IF NOT EXISTS idx_viva_sessions_auto_start ON viva_sessions(status, auto_start, scheduled_at);

-- Update existing sessions to have auto_start and auto_admit enabled
UPDATE viva_sessions SET auto_start = true, auto_admit = true WHERE auto_start IS NULL;
