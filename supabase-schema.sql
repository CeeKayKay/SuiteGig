-- SuiteGig Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Transactions table (banking/bookkeeping)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT DEFAULT 'Unknown',
  account TEXT,
  reconciled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credit cards
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  last_four TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bank accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'checking',
  last_four TEXT,
  balance DECIMAL(12,2) DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses (with receipt support via Supabase Storage)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  merchant TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT DEFAULT 'Unknown',
  card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  card_name TEXT,
  recurring BOOLEAN DEFAULT false,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL,
  client TEXT NOT NULL,
  email TEXT,
  items JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  date DATE,
  due_date DATE,
  paid_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inquiries (leads/prospects)
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  phase TEXT DEFAULT 'new',
  grade TEXT DEFAULT 'B',
  date DATE,
  value DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  next_steps TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client TEXT,
  email TEXT,
  status TEXT DEFAULT 'draft',
  value DECIMAL(12,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  terms TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client TEXT,
  date DATE,
  time TEXT,
  venue TEXT,
  guests INTEGER DEFAULT 0,
  value DECIMAL(12,2) DEFAULT 0,
  email TEXT,
  tasks JSONB DEFAULT '[]',
  emails JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Category rules (merchant -> category mapping)
CREATE TABLE IF NOT EXISTS category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Custom categories
CREATE TABLE IF NOT EXISTS custom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Budgets (per month/category)
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL, -- YYYY-MM format
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(month, category)
);

-- Create storage bucket for receipts
-- Note: Run this separately or via Supabase Dashboard > Storage
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- Enable Row Level Security (RLS) - optional but recommended
-- For now, we'll allow all operations (you can add auth later)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth required)
-- Replace these with proper auth policies later if needed
CREATE POLICY "Allow all" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON credit_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON bank_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON inquiries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON category_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON custom_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON budgets FOR ALL USING (true) WITH CHECK (true);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_phase ON inquiries(phase);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
