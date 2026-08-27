CREATE TABLE "offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"geofence_radius" integer DEFAULT 200 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"role" text DEFAULT 'STAFF' NOT NULL,
	"department" text DEFAULT 'General' NOT NULL,
	"assigned_office" uuid,
	"avatar" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"approval_status" text DEFAULT 'APPROVED' NOT NULL,
	"approval_note" text DEFAULT '' NOT NULL,
	"theme_preference" text DEFAULT 'system' NOT NULL,
	"restricted_pages" text[] DEFAULT '{}'::text[] NOT NULL,
	"google_id" text DEFAULT '' NOT NULL,
	"login_method" text DEFAULT 'PASSWORD' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"verification_otp" text,
	"verification_otp_expiry" timestamp with time zone,
	"temporary_assignment" jsonb,
	"leave_balances" jsonb DEFAULT '{"casual":12,"sick":6,"earned":0}'::jsonb NOT NULL,
	"face_embedding" real[] DEFAULT '{}'::real[] NOT NULL,
	"shift_start_time" text DEFAULT '' NOT NULL,
	"shift_end_time" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_name" text DEFAULT 'EdgeAttendance' NOT NULL,
	"office_latitude" double precision DEFAULT 28.6139 NOT NULL,
	"office_longitude" double precision DEFAULT 77.209 NOT NULL,
	"office_name" text DEFAULT 'Head Office' NOT NULL,
	"geofence_radius" integer DEFAULT 200 NOT NULL,
	"shift_start_time" text DEFAULT '09:00' NOT NULL,
	"shift_end_time" text DEFAULT '18:00' NOT NULL,
	"late_threshold_minutes" integer DEFAULT 15 NOT NULL,
	"working_days" text[] DEFAULT '{Monday,Tuesday,Wednesday,Thursday,Friday}'::text[] NOT NULL,
	"vpn_strict_mode" boolean DEFAULT false NOT NULL,
	"regularization_auto_approve_days" integer DEFAULT 0 NOT NULL,
	"auto_approve_attendance" boolean DEFAULT true NOT NULL,
	"email_notifications" jsonb DEFAULT '{"userUpdates":true,"broadcasts":true,"adminAlerts":true}'::jsonb NOT NULL,
	"leave_policy" jsonb DEFAULT '{"casualPerMonth":1,"sickAnnual":6,"earnedAnnual":12}'::jsonb NOT NULL,
	"accrual_state" jsonb DEFAULT '{"lastMonthlyCL":"","lastAnnualSL":"","lastAnnualEL":""}'::jsonb NOT NULL,
	"mail_from_name" text DEFAULT 'EdgeAttendance Admin' NOT NULL,
	"mail_from_address" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'NATIONAL' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicine_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"generic_name" text DEFAULT '' NOT NULL,
	"manufacturer" text DEFAULT '' NOT NULL,
	"dosage_form" text DEFAULT '' NOT NULL,
	"strength" text DEFAULT '' NOT NULL,
	"pack_size" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"schedule" text DEFAULT 'OTC' NOT NULL,
	"uses" text DEFAULT '' NOT NULL,
	"dosage_timing" text DEFAULT '' NOT NULL,
	"directions_for_use" text DEFAULT '' NOT NULL,
	"storage" text DEFAULT '' NOT NULL,
	"side_effects" text DEFAULT '' NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"price" double precision DEFAULT 0 NOT NULL,
	"purchase_rate" double precision DEFAULT 0 NOT NULL,
	"gst_rate" integer DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"punched_office" uuid,
	"is_cover_duty" boolean DEFAULT false NOT NULL,
	"type" text NOT NULL,
	"selfie_url" text NOT NULL,
	"location" jsonb NOT NULL,
	"ip_address" text DEFAULT '' NOT NULL,
	"vpn_detected" boolean DEFAULT false NOT NULL,
	"vpn_check_details" jsonb,
	"browser_timezone" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"approval_status" text DEFAULT 'PENDING' NOT NULL,
	"approved_by" uuid,
	"admin_comments" text,
	"face_matched" boolean,
	"face_match_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"leave_type" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"admin_feedback" text,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'OTHER' NOT NULL,
	"file_url" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"admin_feedback" text DEFAULT '' NOT NULL,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicine_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by" uuid NOT NULL,
	"medicine_name" text NOT NULL,
	"strength" text DEFAULT '' NOT NULL,
	"quantity" integer NOT NULL,
	"unit" text DEFAULT 'Strips' NOT NULL,
	"urgency" text DEFAULT 'NORMAL' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"admin_feedback" text DEFAULT '' NOT NULL,
	"catalog_medicine" uuid,
	"is_new_medicine" boolean DEFAULT false NOT NULL,
	"handled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient" uuid NOT NULL,
	"type" text DEFAULT 'GENERIC' NOT NULL,
	"title" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"link" text DEFAULT '' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regularizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" text NOT NULL,
	"check_in_time" text NOT NULL,
	"check_out_time" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"admin_feedback" text,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_office_offices_id_fk" FOREIGN KEY ("assigned_office") REFERENCES "public"."offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicine_catalog" ADD CONSTRAINT "medicine_catalog_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_punched_office_offices_id_fk" FOREIGN KEY ("punched_office") REFERENCES "public"."offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exemptions" ADD CONSTRAINT "exemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exemptions" ADD CONSTRAINT "exemptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicine_requests" ADD CONSTRAINT "medicine_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicine_requests" ADD CONSTRAINT "medicine_requests_catalog_medicine_medicine_catalog_id_fk" FOREIGN KEY ("catalog_medicine") REFERENCES "public"."medicine_catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicine_requests" ADD CONSTRAINT "medicine_requests_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_users_id_fk" FOREIGN KEY ("recipient") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regularizations" ADD CONSTRAINT "regularizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regularizations" ADD CONSTRAINT "regularizations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_employee_id_unique" ON "users" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_user_date_type_unique" ON "attendance" USING btree ("user_id","date","type");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "exemptions_user_date_unique" ON "exemptions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "documents_uploaded_by_idx" ON "documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "medicine_requests_status_idx" ON "medicine_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "medicine_requests_requested_by_idx" ON "medicine_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "notifications_recipient_read_idx" ON "notifications" USING btree ("recipient","is_read");