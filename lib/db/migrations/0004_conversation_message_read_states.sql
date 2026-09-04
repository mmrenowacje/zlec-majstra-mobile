ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;