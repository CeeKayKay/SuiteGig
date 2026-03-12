-- SuiteGig Database Schema - Part 2: Row Level Security
-- Run this AFTER creating the tables

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

CREATE POLICY "Allow all inquiries" ON inquiries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all contracts" ON contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all proposals" ON proposals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all credit_cards" ON credit_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all bank_accounts" ON bank_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all category_rules" ON category_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all custom_categories" ON custom_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all budgets" ON budgets FOR ALL USING (true) WITH CHECK (true);
