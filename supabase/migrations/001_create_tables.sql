-- SuiteGig Database Schema - Part 1: Tables
-- Run this in your Supabase SQL Editor

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

CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  last_four TEXT,
  type TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT,
  last_four TEXT,
  color TEXT,
  balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  amount NUMERIC DEFAULT 0,
  period TEXT DEFAULT 'monthly',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
