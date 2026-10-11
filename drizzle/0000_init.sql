CREATE TABLE "articles" (
	"program" text PRIMARY KEY NOT NULL,
	"author" text NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"updated" text NOT NULL,
	"published_at" text,
	"updated_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"student" text NOT NULL,
	"program" text NOT NULL,
	"title" text NOT NULL,
	"due" text NOT NULL,
	"submitted" text,
	"status" text NOT NULL,
	"score" integer,
	"feedback" text DEFAULT '' NOT NULL,
	"teacher" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"program" text NOT NULL,
	"team" text NOT NULL,
	"teacher" text NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"status" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"student" text NOT NULL,
	"program" text NOT NULL,
	"team" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedbacks" (
	"id" text PRIMARY KEY NOT NULL,
	"student" text NOT NULL,
	"course" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"next" text DEFAULT '' NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"date" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"en" text NOT NULL,
	"short" text NOT NULL,
	"type" text NOT NULL,
	"color" text NOT NULL,
	"description" text NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL,
	"curriculum" text NOT NULL,
	"draft" text,
	"published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"program" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"format" text NOT NULL,
	"size" text NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"file" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"health" text NOT NULL,
	"health_note" text DEFAULT '' NOT NULL,
	"previous_health" text,
	"changed_by" integer,
	"changed_by_name" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"program" text NOT NULL,
	"team" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"sales" text NOT NULL,
	"updated" text NOT NULL,
	"grade" text NOT NULL,
	"health" text NOT NULL,
	"health_note" text DEFAULT '' NOT NULL,
	"health_updated" text DEFAULT '' NOT NULL,
	"health_by" text DEFAULT '' NOT NULL,
	"health_changed_at" timestamp with time zone,
	"health_changed_by" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"program" text NOT NULL,
	"teacher" text NOT NULL,
	"stage" integer NOT NULL,
	"status" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"sales_name" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_program_programs_id_fk" FOREIGN KEY ("program") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_student_students_id_fk" FOREIGN KEY ("student") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_program_programs_id_fk" FOREIGN KEY ("program") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_students_id_fk" FOREIGN KEY ("student") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_program_programs_id_fk" FOREIGN KEY ("program") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_student_students_id_fk" FOREIGN KEY ("student") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_program_programs_id_fk" FOREIGN KEY ("program") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_status_history" ADD CONSTRAINT "student_status_history_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_status_history" ADD CONSTRAINT "student_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_program_programs_id_fk" FOREIGN KEY ("program") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_health_changed_by_users_id_fk" FOREIGN KEY ("health_changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_program_programs_id_fk" FOREIGN KEY ("program") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_student_idx" ON "assignments" USING btree ("student");--> statement-breakpoint
CREATE INDEX "student_status_history_student_idx" ON "student_status_history" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "students_sales_idx" ON "students" USING btree ("sales");