-- Migration: Add unique constraint to subscribers.email column
-- This prevents duplicate email entries at the database level

-- First, remove any existing duplicates (keeping the first occurrence of each email)
DELETE FROM subscribers 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM subscribers 
  GROUP BY email
);

-- Add unique constraint to email column
ALTER TABLE subscribers 
ADD CONSTRAINT subscribers_email_unique UNIQUE (email);

-- Optional: Add an index for better performance on email lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email); 