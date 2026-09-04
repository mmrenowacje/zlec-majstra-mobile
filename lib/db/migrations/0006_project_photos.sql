CREATE TABLE IF NOT EXISTS project_photos (
  id serial PRIMARY KEY,
  review_id integer NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  request_id integer NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  contractor_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  object_path text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_photos_contractor_created_idx
  ON project_photos(contractor_id, created_at);