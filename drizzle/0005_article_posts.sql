CREATE TABLE "article_post_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"visitor" text NOT NULL,
	"kind" text NOT NULL,
	"bucket" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"project_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"author" text NOT NULL,
	"author_email" text DEFAULT '' NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"views" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "article_post_events" ADD CONSTRAINT "article_post_events_post_id_article_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."article_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_posts" ADD CONSTRAINT "article_posts_project_id_programs_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_posts" ADD CONSTRAINT "article_posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_posts" ADD CONSTRAINT "article_posts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_post_events_dedupe_idx" ON "article_post_events" USING btree ("post_id","visitor","bucket");--> statement-breakpoint
CREATE INDEX "article_post_events_post_idx" ON "article_post_events" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "article_posts_project_idx" ON "article_posts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "article_posts_status_idx" ON "article_posts" USING btree ("status");