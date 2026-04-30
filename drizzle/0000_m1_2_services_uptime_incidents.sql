CREATE TYPE "public"."incident_severity" AS ENUM('partial', 'total');--> statement-breakpoint
CREATE TYPE "public"."sphere" AS ENUM('federal', 'estadual', 'municipal');--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_slug" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"status_code" integer,
	"error_message" text,
	"severity" "incident_severity" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_uptime_hourly" (
	"service_slug" text NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"uptime_pct" numeric(5, 2) NOT NULL,
	"avg_latency_ms" integer NOT NULL,
	"total_checks" integer NOT NULL,
	"failed_checks" integer NOT NULL,
	CONSTRAINT "service_uptime_hourly_service_slug_hour_pk" PRIMARY KEY("service_slug","hour")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"agency" text NOT NULL,
	"category" text NOT NULL,
	"sphere" "sphere" NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_service_slug_services_slug_fk" FOREIGN KEY ("service_slug") REFERENCES "public"."services"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_uptime_hourly" ADD CONSTRAINT "service_uptime_hourly_service_slug_services_slug_fk" FOREIGN KEY ("service_slug") REFERENCES "public"."services"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_incidents_service" ON "incidents" USING btree ("service_slug","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_uptime_service_hour" ON "service_uptime_hourly" USING btree ("service_slug","hour" DESC NULLS LAST);