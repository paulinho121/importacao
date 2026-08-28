ALTER TABLE "products" ADD COLUMN "carton_pieces_per_carton" numeric(6, 0);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "carton_length_cm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "carton_width_cm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "carton_height_cm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "carton_weight_kg" numeric(8, 2);