CREATE TABLE "class_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rate" double precision NOT NULL,
	"unit" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_feedbacks" (
	"id" text PRIMARY KEY NOT NULL,
	"course" text NOT NULL,
	"lesson" text,
	"date" text NOT NULL,
	"attendance" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"performance" text DEFAULT '' NOT NULL,
	"issues" text DEFAULT '' NOT NULL,
	"next_steps" text DEFAULT '' NOT NULL,
	"ops_teacher" text NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_records" (
	"id" text PRIMARY KEY NOT NULL,
	"course" text NOT NULL,
	"date" text NOT NULL,
	"hours" double precision NOT NULL,
	"students" integer,
	"ops_teacher" text NOT NULL,
	"rate" double precision NOT NULL,
	"unit" text NOT NULL,
	"amount" double precision NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_courses" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"project" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"class_type" text NOT NULL,
	"teacher" text DEFAULT '' NOT NULL,
	"ops_teacher" text DEFAULT '' NOT NULL,
	"start_date" text DEFAULT '' NOT NULL,
	"end_date" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ops_courses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"start_date" text DEFAULT '' NOT NULL,
	"end_date" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_feedbacks" ADD CONSTRAINT "lesson_feedbacks_course_ops_courses_id_fk" FOREIGN KEY ("course") REFERENCES "public"."ops_courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_records" ADD CONSTRAINT "lesson_records_course_ops_courses_id_fk" FOREIGN KEY ("course") REFERENCES "public"."ops_courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_courses" ADD CONSTRAINT "ops_courses_project_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_courses" ADD CONSTRAINT "ops_courses_class_type_class_types_id_fk" FOREIGN KEY ("class_type") REFERENCES "public"."class_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_feedbacks_ops_teacher_idx" ON "lesson_feedbacks" USING btree ("ops_teacher","date");--> statement-breakpoint
CREATE INDEX "lesson_feedbacks_course_idx" ON "lesson_feedbacks" USING btree ("course");--> statement-breakpoint
CREATE INDEX "lesson_records_ops_teacher_idx" ON "lesson_records" USING btree ("ops_teacher","date");--> statement-breakpoint
CREATE INDEX "lesson_records_course_idx" ON "lesson_records" USING btree ("course");--> statement-breakpoint
CREATE INDEX "ops_courses_project_idx" ON "ops_courses" USING btree ("project");--> statement-breakpoint
CREATE INDEX "ops_courses_ops_teacher_idx" ON "ops_courses" USING btree ("ops_teacher");