-- Add date_issued column to invoices table
-- This stores the actual invoice date (Date Issued) separate from created_at

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS date_issued TEXT;

-- Update existing records to use created_at as date_issued if not set
UPDATE invoices SET date_issued = created_at::date::text WHERE date_issued IS NULL;
