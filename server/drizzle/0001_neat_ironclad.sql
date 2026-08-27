ALTER TABLE "users" ADD COLUMN "reset_password_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_password_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "app_logo" text;