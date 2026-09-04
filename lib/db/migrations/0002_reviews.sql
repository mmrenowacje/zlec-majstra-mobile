CREATE TABLE IF NOT EXISTS "reviews" (
  "id" serial PRIMARY KEY NOT NULL,
  "request_id" integer NOT NULL,
  "customer_id" text NOT NULL,
  "contractor_id" text NOT NULL,
  "rating" integer NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "reviews_body_length" CHECK (char_length(btrim("body")) BETWEEN 1 AND 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS "reviews_request_contractor_unique"
  ON "reviews" USING btree ("request_id", "contractor_id");

CREATE TABLE IF NOT EXISTS "review_replies" (
  "id" serial PRIMARY KEY NOT NULL,
  "review_id" integer NOT NULL,
  "contractor_id" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "review_replies_body_length" CHECK (char_length(btrim("body")) BETWEEN 1 AND 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS "review_replies_review_unique"
  ON "review_replies" USING btree ("review_id");