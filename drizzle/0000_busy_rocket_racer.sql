CREATE TYPE "public"."measurement_kind" AS ENUM('weight_kg', 'shoulders_cm', 'chest_cm', 'biceps_cm', 'waist_cm', 'hips_cm', 'thigh_cm', 'calf_cm', 'body_fat_pct', 'muscle_pct');--> statement-breakpoint
CREATE TABLE "measurement_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"measured_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" "measurement_kind" NOT NULL,
	"value" numeric(5, 1) NOT NULL,
	CONSTRAINT "measurements_session_kind_unique" UNIQUE("session_id","kind"),
	CONSTRAINT "measurements_value_positive" CHECK ("measurements"."value" > 0)
);
--> statement-breakpoint
ALTER TABLE "measurement_sessions" ADD CONSTRAINT "measurement_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_session_id_measurement_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."measurement_sessions"("id") ON DELETE cascade ON UPDATE no action;