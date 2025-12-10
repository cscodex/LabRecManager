-- ============================================================
-- Viva Waiting Room Feature - Run in Neon SQL Editor
-- ============================================================

-- Step 1: Create ParticipantStatus enum if not exists
DO $$ BEGIN
    CREATE TYPE "ParticipantStatus" AS ENUM ('waiting', 'admitted', 'in_session', 'left', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Create viva_participants table for waiting room
CREATE TABLE IF NOT EXISTS viva_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES viva_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(50) NOT NULL DEFAULT 'student',
    status "ParticipantStatus" NOT NULL DEFAULT 'waiting',
    joined_waiting_at TIMESTAMP NOT NULL DEFAULT NOW(),
    admitted_at TIMESTAMP,
    left_at TIMESTAMP,
    socket_id VARCHAR(255),
    is_video_enabled BOOLEAN NOT NULL DEFAULT false,
    is_audio_enabled BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(session_id, user_id)
);

-- Step 3: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_viva_participants_session_id ON viva_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_viva_participants_user_id ON viva_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_viva_participants_status ON viva_participants(status);

-- Verify the table was created
SELECT 'viva_participants table created successfully' as status;
