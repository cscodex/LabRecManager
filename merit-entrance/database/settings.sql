-- Create system_settings table
CREATE TABLE IF NOT EXISTS "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- Insert default settings
INSERT INTO "system_settings" ("key", "value", "description", "updated_at")
VALUES 
('default_ai_model', '"gemini-1.5-flash"', 'Default AI model for extraction', NOW())
ON CONFLICT ("key") DO NOTHING;
