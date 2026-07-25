ALTER TABLE "processes" ADD COLUMN "vessel_name" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "vessel_imo" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "vessel_mmsi" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "vessel_lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "vessel_lon" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "vessel_speed_knots" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "vessel_heading" integer;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "vessel_destination" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "vessel_position_updated_at" timestamp with time zone;