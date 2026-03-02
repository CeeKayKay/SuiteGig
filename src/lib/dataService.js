import { supabase, isSupabaseConfigured } from './supabase';

// ══════════════════════════════════════════════════════════════
// LOCAL STORAGE FALLBACK
// ══════════════════════════════════════════════════════════════

const loadLocal = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch { return fallback; }
};

const saveLocal = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save ${key}:`, e.message);
  }
};

// ══════════════════════════════════════════════════════════════
// DATA SERVICE - Abstracts Supabase / localStorage
// ══════════════════════════════════════════════════════════════

class DataService {
  constructor() {
    this.useSupabase = isSupabaseConfigured();
    this.cache = {};
    this.subscribers = {};
  }

  // Subscribe to real-time changes (Supabase only)
  subscribe(table, callback) {
    if (!this.useSupabase) return () => {};

    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => callback(payload)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  // ── GENERIC CRUD ──────────────────────────────────────────

  async getAll(table, localKey, fallback = []) {
    if (!this.useSupabase) {
      return loadLocal(localKey, fallback);
    }

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching ${table}:`, error);
      return loadLocal(localKey, fallback); // Fallback to local
    }

    return data || [];
  }

  async upsert(table, localKey, record) {
    if (!this.useSupabase) {
      const all = loadLocal(localKey, []);
      const idx = all.findIndex(r => r.id === record.id);
      if (idx >= 0) {
        all[idx] = { ...all[idx], ...record };
      } else {
        all.unshift(record);
      }
      saveLocal(localKey, all);
      return record;
    }

    const { data, error } = await supabase
      .from(table)
      .upsert(record, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error(`Error upserting ${table}:`, error);
      throw error;
    }

    return data;
  }

  async upsertMany(table, localKey, records) {
    if (!this.useSupabase) {
      saveLocal(localKey, records);
      return records;
    }

    const { data, error } = await supabase
      .from(table)
      .upsert(records, { onConflict: 'id' })
      .select();

    if (error) {
      console.error(`Error upserting many ${table}:`, error);
      throw error;
    }

    return data;
  }

  async delete(table, localKey, id) {
    if (!this.useSupabase) {
      const all = loadLocal(localKey, []);
      saveLocal(localKey, all.filter(r => r.id !== id));
      return true;
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting from ${table}:`, error);
      throw error;
    }

    return true;
  }

  async saveAll(table, localKey, records) {
    if (!this.useSupabase) {
      saveLocal(localKey, records);
      return records;
    }

    // For full replacement, delete all and insert fresh
    // Or use upsert with all records
    const { error: delError } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (records.length === 0) return [];

    const { data, error } = await supabase
      .from(table)
      .insert(records)
      .select();

    if (error) {
      console.error(`Error saving all ${table}:`, error);
      throw error;
    }

    return data;
  }

  // ── SPECIFIC TABLE METHODS ───────────────────────────────

  // Transactions
  async getTransactions() {
    return this.getAll('transactions', 'cs_transactions', []);
  }

  async saveTransactions(transactions) {
    return this.upsertMany('transactions', 'cs_transactions', transactions);
  }

  // Expenses - transform between app format and Supabase format
  _expenseToSupabase(exp) {
    return {
      id: exp.id,
      date: exp.date,
      merchant: exp.merchant,
      amount: exp.amount,
      category: exp.category || 'Unknown',
      card_name: exp.cardLast4 || null,
      recurring: exp.recurring || false,
      notes: exp.notes || null,
      receipt_url: typeof exp.receipt === 'string' && exp.receipt.startsWith('http') ? exp.receipt : null,
    };
  }

  _expenseFromSupabase(row) {
    return {
      id: row.id,
      date: row.date,
      merchant: row.merchant,
      amount: parseFloat(row.amount),
      category: row.category || 'Unknown',
      cardLast4: row.card_name || 'manual',
      recurring: row.recurring || false,
      notes: row.notes || '',
      receipt: row.receipt_url || null,
      status: row.category === 'Unknown' ? 'needs_review' : 'categorized',
    };
  }

  async getExpenses() {
    console.log('[DataService] getExpenses called, useSupabase:', this.useSupabase);

    // Always check localStorage first
    const local = loadLocal('cs_expenses', []);
    console.log('[DataService] localStorage has:', local.length, 'expenses');

    if (!this.useSupabase) {
      return local;
    }

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('[DataService] Error fetching expenses from Supabase:', error);
        return local;
      }

      const supabaseData = (data || []).map(row => this._expenseFromSupabase(row));
      console.log('[DataService] Supabase has:', supabaseData.length, 'expenses');

      // If Supabase is empty but localStorage has data, sync localStorage to Supabase
      if (supabaseData.length === 0 && local.length > 0) {
        console.log('[DataService] Syncing localStorage to Supabase...');
        await this.saveExpenses(local);
        return local;
      }

      // If Supabase has data, use it and update localStorage
      if (supabaseData.length > 0) {
        saveLocal('cs_expenses', supabaseData);
        return supabaseData;
      }

      return local;
    } catch (err) {
      console.error('[DataService] Exception in getExpenses:', err);
      return local;
    }
  }

  async saveExpenses(expenses) {
    console.log('[DataService] saveExpenses called with', expenses.length, 'expenses, useSupabase:', this.useSupabase);

    // Always save to localStorage as backup
    saveLocal('cs_expenses', expenses);
    console.log('[DataService] Saved to localStorage backup');

    if (!this.useSupabase) {
      return expenses;
    }

    try {
      // Transform to Supabase format
      const rows = expenses.map(exp => this._expenseToSupabase(exp));
      console.log('[DataService] Transformed rows:', rows.length);

      // Delete all existing and insert fresh
      const { error: deleteError } = await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (deleteError) {
        console.error('[DataService] Error deleting expenses:', deleteError);
      }

      if (rows.length > 0) {
        const { data, error } = await supabase
          .from('expenses')
          .insert(rows)
          .select();

        if (error) {
          console.error('[DataService] Error inserting expenses:', error);
          return expenses; // Return original, already saved to localStorage
        }

        console.log('[DataService] Saved to Supabase:', (data || []).length, 'expenses');
        return (data || []).map(row => this._expenseFromSupabase(row));
      }

      return [];
    } catch (err) {
      console.error('[DataService] Exception in saveExpenses:', err);
      return expenses; // Return original, already saved to localStorage
    }
  }

  async saveExpense(expense) {
    if (!this.useSupabase) {
      const all = loadLocal('cs_expenses', []);
      const idx = all.findIndex(e => e.id === expense.id);
      if (idx >= 0) all[idx] = expense;
      else all.unshift(expense);
      saveLocal('cs_expenses', all);
      return expense;
    }

    const row = this._expenseToSupabase(expense);
    const { data, error } = await supabase
      .from('expenses')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving expense:', error);
      throw error;
    }

    return this._expenseFromSupabase(data);
  }

  async deleteExpense(id) {
    return this.delete('expenses', 'cs_expenses', id);
  }

  // Invoices
  async getInvoices() {
    return this.getAll('invoices', 'cs_invoices', []);
  }

  async saveInvoices(invoices) {
    return this.upsertMany('invoices', 'cs_invoices', invoices);
  }

  // Inquiries
  async getInquiries() {
    return this.getAll('inquiries', 'cs_inquiries', []);
  }

  async saveInquiries(inquiries) {
    return this.upsertMany('inquiries', 'cs_inquiries', inquiries);
  }

  // Contracts
  async getContracts() {
    return this.getAll('contracts', 'cs_contracts', []);
  }

  async saveContracts(contracts) {
    return this.upsertMany('contracts', 'cs_contracts', contracts);
  }

  // Events
  async getEvents() {
    return this.getAll('events', 'cs_events', []);
  }

  async saveEvents(events) {
    return this.upsertMany('events', 'cs_events', events);
  }

  // Credit Cards
  async getCreditCards() {
    return this.getAll('credit_cards', 'cs_creditCards', []);
  }

  async saveCreditCards(cards) {
    return this.upsertMany('credit_cards', 'cs_creditCards', cards);
  }

  // Bank Accounts
  async getBankAccounts() {
    return this.getAll('bank_accounts', 'cs_bankAccounts', []);
  }

  async saveBankAccounts(accounts) {
    return this.upsertMany('bank_accounts', 'cs_bankAccounts', accounts);
  }

  // Category Rules (stored as key-value in local, as rows in Supabase)
  async getCategoryRules() {
    if (!this.useSupabase) {
      return loadLocal('cs_categoryRules', {});
    }

    const { data, error } = await supabase
      .from('category_rules')
      .select('*');

    if (error) {
      console.error('Error fetching category rules:', error);
      return loadLocal('cs_categoryRules', {});
    }

    // Convert array to object
    return (data || []).reduce((acc, row) => {
      acc[row.merchant] = row.category;
      return acc;
    }, {});
  }

  async saveCategoryRules(rules) {
    if (!this.useSupabase) {
      saveLocal('cs_categoryRules', rules);
      return rules;
    }

    // Convert object to array for Supabase
    const rows = Object.entries(rules).map(([merchant, category]) => ({
      merchant,
      category
    }));

    // Clear and re-insert
    await supabase.from('category_rules').delete().neq('merchant', '');

    if (rows.length > 0) {
      const { error } = await supabase
        .from('category_rules')
        .insert(rows);

      if (error) {
        console.error('Error saving category rules:', error);
        throw error;
      }
    }

    return rules;
  }

  // Custom Categories
  async getCustomCategories() {
    if (!this.useSupabase) {
      return loadLocal('cs_customCategories', []);
    }

    const { data, error } = await supabase
      .from('custom_categories')
      .select('name');

    if (error) {
      console.error('Error fetching custom categories:', error);
      return loadLocal('cs_customCategories', []);
    }

    return (data || []).map(row => row.name);
  }

  async saveCustomCategories(categories) {
    if (!this.useSupabase) {
      saveLocal('cs_customCategories', categories);
      return categories;
    }

    await supabase.from('custom_categories').delete().neq('name', '');

    if (categories.length > 0) {
      const rows = categories.map(name => ({ name }));
      const { error } = await supabase
        .from('custom_categories')
        .insert(rows);

      if (error) {
        console.error('Error saving custom categories:', error);
        throw error;
      }
    }

    return categories;
  }

  // Budgets (stored as object in local, as rows in Supabase)
  async getBudgets() {
    if (!this.useSupabase) {
      return loadLocal('cs_budgets', {});
    }

    const { data, error } = await supabase
      .from('budgets')
      .select('*');

    if (error) {
      console.error('Error fetching budgets:', error);
      return loadLocal('cs_budgets', {});
    }

    // Convert array to nested object { month: { category: amount } }
    return (data || []).reduce((acc, row) => {
      if (!acc[row.month]) acc[row.month] = {};
      acc[row.month][row.category] = row.amount;
      return acc;
    }, {});
  }

  async saveBudgets(budgets) {
    if (!this.useSupabase) {
      saveLocal('cs_budgets', budgets);
      return budgets;
    }

    // Convert nested object to array
    const rows = [];
    for (const [month, categories] of Object.entries(budgets)) {
      for (const [category, amount] of Object.entries(categories)) {
        rows.push({ month, category, amount });
      }
    }

    await supabase.from('budgets').delete().neq('month', '');

    if (rows.length > 0) {
      const { error } = await supabase
        .from('budgets')
        .insert(rows);

      if (error) {
        console.error('Error saving budgets:', error);
        throw error;
      }
    }

    return budgets;
  }

  // ── RECEIPT STORAGE ──────────────────────────────────────

  async uploadReceipt(expenseId, file) {
    if (!this.useSupabase) {
      // For local, return base64 data URL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${expenseId}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error('Error uploading receipt:', error);
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  }

  async deleteReceipt(expenseId) {
    if (!this.useSupabase) return;

    const { error } = await supabase.storage
      .from('receipts')
      .remove([`${expenseId}.jpg`, `${expenseId}.png`, `${expenseId}.pdf`]);

    if (error) {
      console.error('Error deleting receipt:', error);
    }
  }
}

// Export singleton instance
export const dataService = new DataService();
export default dataService;
