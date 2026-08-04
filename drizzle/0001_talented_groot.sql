CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"height_cm" numeric(4, 1),
	CONSTRAINT "profiles_height_cm_range" CHECK ("profiles"."height_cm" between 80 and 260)
);
