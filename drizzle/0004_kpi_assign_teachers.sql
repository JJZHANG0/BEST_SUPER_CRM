CREATE TABLE "kpi_sheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"month" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"items" jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by" integer,
	"reviewed_by_name" text,
	"review_note" text DEFAULT '' NOT NULL,
	"finalized_at" timestamp with time zone,
	"total" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "assigned_by" integer;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "assigned_by_name" text;--> statement-breakpoint
ALTER TABLE "kpi_sheets" ADD CONSTRAINT "kpi_sheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_sheets" ADD CONSTRAINT "kpi_sheets_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_sheets_user_month_idx" ON "kpi_sheets" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "kpi_sheets_month_idx" ON "kpi_sheets" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_name_idx" ON "teachers" USING btree ("name");--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todos_assigned_by_idx" ON "todos" USING btree ("assigned_by");