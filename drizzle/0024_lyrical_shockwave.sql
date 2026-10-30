CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"state" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "locations_code_kind_unique" UNIQUE("code","kind")
);
--> statement-breakpoint
CREATE TABLE "shipment_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modality" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"modal_code" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "shipment_types_modality_name_unique" UNIQUE("modality","name")
);
