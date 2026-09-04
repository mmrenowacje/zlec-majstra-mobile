ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS digital_service_accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS recurring_payments_accepted_at timestamp with time zone;