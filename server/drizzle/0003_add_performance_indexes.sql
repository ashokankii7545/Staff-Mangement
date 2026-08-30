-- Performance indexes for hot query paths (dashboard, attendance summary,
-- leave overlap checks, Google login). All are additive; no data changes.
--
-- Plain CREATE INDEX (not CONCURRENTLY) so drizzle-kit's transactional
-- migrator can run this. IF NOT EXISTS keeps it idempotent/re-runnable.
-- Index builds briefly lock each table; at current table sizes this is
-- sub-second. For very large tables, build these CONCURRENTLY out-of-band
-- via the Supabase SQL editor on a direct (5432) connection instead.
CREATE INDEX IF NOT EXISTS "users_role_active_idx" ON "users" USING btree ("role","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_approval_role_idx" ON "users" USING btree ("approval_status","role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_google_id_idx" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_type_date_idx" ON "attendance" USING btree ("type","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_created_at_idx" ON "attendance" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_status_range_idx" ON "leave_requests" USING btree ("status","start_date","end_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_user_created_idx" ON "leave_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regularizations_user_date_idx" ON "regularizations" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regularizations_status_idx" ON "regularizations" USING btree ("status");
