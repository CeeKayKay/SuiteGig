-- SuiteGig Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  contact TEXT,
  email TEXT,
  phone TEXT,
  phase TEXT DEFAULT 'new',
  grade TEXT DEFAULT 'B',
  date TEXT,
  value NUMERIC DEFAULT 0,
  notes TEXT,
  next_steps TEXT,
  source_input TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client TEXT,
  event_name TEXT,
  event_date TEXT,
  venue TEXT,
  value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  terms TEXT,
  notes TEXT,
  signed_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  client TEXT,
  date TEXT,
  time TEXT,
  venue TEXT,
  address TEXT,
  status TEXT DEFAULT 'upcoming',
  notes TEXT,
  tasks JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  client TEXT,
  content TEXT,
  extracted_data JSONB,
  source_notes TEXT,
  original_content TEXT,
  status TEXT DEFAULT 'draft',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  last_modified TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT,
  client TEXT,
  event_name TEXT,
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  due_date TEXT,
  paid_date TEXT,
  items JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT,
  description TEXT,
  amount NUMERIC DEFAULT 0,
  type TEXT,
  category TEXT,
  account TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT,
  description TEXT,
  amount NUMERIC DEFAULT 0,
  category TEXT,
  vendor TEXT,
  payment_method TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Cards table
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  last_four TEXT,
  type TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT,
  last_four TEXT,
  color TEXT,
  balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category Rules table (for auto-categorization)
CREATE TABLE IF NOT EXISTS category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Categories table
CREATE TABLE IF NOT EXISTS custom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  amount NUMERIC DEFAULT 0,
  period TEXT DEFAULT 'monthly',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for development)
-- In production, you'd want more restrictive policies based on user auth

CREATE POLICY "Allow all" ON inquiries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON proposals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON credit_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON bank_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON category_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON custom_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON budgets FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inquiries_phase ON inquiries(phase);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
