-- Add verification fields to admins table for password reset functionality
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "verification_token" TEXT;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "verification_expires" TIMESTAMP(3);
