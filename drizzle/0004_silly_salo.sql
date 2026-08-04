CREATE TYPE "public"."profile_sex" AS ENUM('male', 'female');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "sex" "profile_sex";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "transformation_started_on" date;