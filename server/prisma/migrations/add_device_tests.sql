-- Create device_tests table for storing camera, mic, speaker test results
CREATE TABLE IF NOT EXISTS device_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Camera test fields
    camera_status VARCHAR(50),
    camera_tested_at TIMESTAMP,
    camera_device_id TEXT,
    camera_device_name TEXT,
    
    -- Microphone test fields
    mic_status VARCHAR(50),
    mic_tested_at TIMESTAMP,
    mic_device_id TEXT,
    mic_device_name TEXT,
    
    -- Speaker test fields
    speaker_status VARCHAR(50),
    speaker_tested_at TIMESTAMP,
    speaker_device_id TEXT,
    speaker_device_name TEXT,
    speaker_volume INTEGER,
    
    -- Metadata
    user_agent TEXT,
    platform VARCHAR(50),
    browser VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- One record per user
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_device_tests_user_id ON device_tests(user_id);

-- Comment for documentation
COMMENT ON TABLE device_tests IS 'Stores device (camera, mic, speaker) test results for viva session preparation';
