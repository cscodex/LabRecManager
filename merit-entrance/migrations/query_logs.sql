-- Create query_logs table for tracking API errors and query execution
CREATE TABLE IF NOT EXISTS query_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    query TEXT,
    params TEXT,
    success BOOLEAN DEFAULT true,
    error TEXT,
    duration INTEGER,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_query_logs_success_created_at ON query_logs (success, created_at);
CREATE INDEX IF NOT EXISTS idx_query_logs_route ON query_logs (route);
CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON query_logs (created_at DESC);
