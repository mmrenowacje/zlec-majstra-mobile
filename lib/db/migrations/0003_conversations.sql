CREATE TABLE IF NOT EXISTS "conversations" (
  "id" serial PRIMARY KEY NOT NULL,
  "request_id" integer NOT NULL,
  "customer_id" text NOT NULL,
  "contractor_id" text NOT NULL,
  "customer_contact_shared" boolean DEFAULT false NOT NULL,
  "customer_contact_shared_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "conversations"
  DROP CONSTRAINT IF EXISTS "conversations_request_id_unique";
DROP INDEX IF EXISTS "conversations_request_id_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "conversations_request_contractor_unique"
  ON "conversations" USING btree ("request_id", "contractor_id");
CREATE INDEX IF NOT EXISTS "conversations_customer_request_idx"
  ON "conversations" USING btree ("customer_id", "request_id");

CREATE TABLE IF NOT EXISTS "conversation_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "conversation_id" integer NOT NULL,
  "sender_id" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "conversation_messages_conversation_created_idx"
  ON "conversation_messages" USING btree ("conversation_id", "created_at");