DO $$ BEGIN
  CREATE TYPE "subscription_reminder_type" AS ENUM ('three_day', 'one_day');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "subscription_reminder_status" AS ENUM ('pending', 'sending', 'sent', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "subscription_reminder_status" ADD VALUE IF NOT EXISTS 'sending' BEFORE 'sent';

CREATE TABLE IF NOT EXISTS "subscription_reminders" (
  "id" serial PRIMARY KEY NOT NULL,
  "subscription_id" integer NOT NULL,
  "profile_id" text NOT NULL,
  "type" "subscription_reminder_type" NOT NULL,
  "access_expires_at" timestamp with time zone NOT NULL,
  "status" "subscription_reminder_status" DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp with time zone,
  "next_attempt_at" timestamp with time zone,
  "lease_until" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "subscription_reminders"
  ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamp with time zone;
ALTER TABLE "subscription_reminders"
  ADD COLUMN IF NOT EXISTS "lease_until" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_reminders_identity_unique"
  ON "subscription_reminders" USING btree ("subscription_id", "type", "access_expires_at");