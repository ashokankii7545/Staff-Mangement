-- Staff Profile dialog: admin-managed compensation columns on users.
-- Both are nullable jsonb (null = not set). Existing rows are unaffected.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "salary" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bonus" jsonb;
