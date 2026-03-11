import { supabase, isSupabaseConfigured } from './supabase';

// ══════════════════════════════════════════════════════════════
// UUID HELPERS
// ══════════════════════════════════════════════════════════════

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUUID = (id) => UUID_REGEX.test(id);

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Map to track old ID -> new UUID conversions
const idMigrationMap = new Map();

const ensureUUID = (id) => {
  if (isValidUUID(id)) return id;
  // Check if we already converted this ID
  if (idMigrationMap.has(id)) return idMigrationMap.get(id);
  // Generate new UUID and remember mapping
  const newId = generateUUID();
  idMigrationMap.set(id, newId);
  return newId;
};

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

  // Force sync all local data to Supabase (for manual sync button)
  async forceSyncToCloud() {
    if (!this.useSupabase) {
      console.log('[DataService] Supabase not configured, cannot sync');
      return { success: false, error: 'Supabase not configured' };
    }

    console.log('[DataService] Force syncing all data to Supabase...');
    const results = {};

    try {
      // Sync category rules
      const localRules = loadLocal('cs_categoryRules', {});
      if (Object.keys(localRules).length > 0) {
        await this.saveCategoryRules(localRules);
        results.categoryRules = Object.keys(localRules).length;
      }

      // Sync custom categories
      const localCategories = loadLocal('cs_customCategories', []);
      if (localCategories.length > 0) {
        await this.saveCustomCategories(localCategories);
        results.customCategories = localCategories.length;
      }

      // Sync expenses
      const localExpenses = loadLocal('cs_expenses', []);
      if (localExpenses.length > 0) {
        await this.saveExpenses(localExpenses);
        results.expenses = localExpenses.length;
      }

      console.log('[DataService] Force sync complete:', results);
      return { success: true, results };
    } catch (err) {
      console.error('[DataService] Force sync failed:', err);
      return { success: false, error: err.message };
    }
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
    // Always load localStorage first
    const localData = loadLocal(localKey, fallback);

    if (!this.useSupabase) {
      return localData;
    }

    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`Error fetching ${table}:`, error);
        return localData; // Fallback to local
      }

      // If Supabase is empty but localStorage has data, use localStorage
      if ((!data || data.length === 0) && localData.length > 0) {
        console.log(`[DataService] ${table}: Supabase empty, using localStorage (${localData.length} items)`);
        return localData;
      }

      // If both have data, merge them (Supabase takes precedence for same IDs)
      if (data && data.length > 0 && localData.length > 0) {
        const supabaseIds = new Set(data.map(d => d.id));
        const localOnly = localData.filter(l => !supabaseIds.has(l.id));
        if (localOnly.length > 0) {
          console.log(`[DataService] ${table}: Merging ${localOnly.length} local-only items with Supabase`);
          return [...data, ...localOnly];
        }
      }

      return data || [];
    } catch (err) {
      console.error(`Error fetching ${table}:`, err);
      return localData;
    }
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
      id: ensureUUID(exp.id), // Convert non-UUID IDs to valid UUIDs
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

  // Proposals - primarily localStorage based (Supabase table may not exist)
  async getProposals() {
    // Always use localStorage for proposals
    return loadLocal('cs_proposals', []);
  }

  async saveProposals(proposals) {
    // Always save to localStorage for proposals
    saveLocal('cs_proposals', proposals);
    return proposals;
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
    console.log('[DataService] getCategoryRules called, useSupabase:', this.useSupabase);

    // Always check localStorage first
    const local = loadLocal('cs_categoryRules', {});
    console.log('[DataService] localStorage has', Object.keys(local).length, 'category rules');

    if (!this.useSupabase) {
      return local;
    }

    try {
      const { data, error } = await supabase
        .from('category_rules')
        .select('*');

      if (error) {
        console.error('[DataService] Error fetching category rules:', error);
        return local;
      }

      // Convert array to object
      const supabaseRules = (data || []).reduce((acc, row) => {
        acc[row.merchant] = row.category;
        return acc;
      }, {});
      console.log('[DataService] Supabase has', Object.keys(supabaseRules).length, 'category rules');

      // If Supabase is empty but localStorage has data, sync localStorage to Supabase
      if (Object.keys(supabaseRules).length === 0 && Object.keys(local).length > 0) {
        console.log('[DataService] Syncing localStorage category rules to Supabase...');
        await this.saveCategoryRules(local);
        return local;
      }

      // If Supabase has data, merge with local (Supabase takes precedence, but keep local-only rules)
      if (Object.keys(supabaseRules).length > 0) {
        const merged = { ...local, ...supabaseRules };
        saveLocal('cs_categoryRules', merged);
        return merged;
      }

      return local;
    } catch (err) {
      console.error('[DataService] Exception in getCategoryRules:', err);
      return local;
    }
  }

  async saveCategoryRules(rules) {
    console.log('[DataService] saveCategoryRules called with', Object.keys(rules).length, 'rules, useSupabase:', this.useSupabase);

    // Always save to localStorage as backup
    saveLocal('cs_categoryRules', rules);
    console.log('[DataService] Saved category rules to localStorage backup');

    if (!this.useSupabase) {
      return rules;
    }

    try {
      // Convert object to array for Supabase
      const rows = Object.entries(rules).map(([merchant, category]) => ({
        merchant,
        category
      }));

      // Clear and re-insert
      const { error: deleteError } = await supabase.from('category_rules').delete().neq('merchant', '');
      if (deleteError) {
        console.error('[DataService] Error deleting category rules:', deleteError);
      }

      if (rows.length > 0) {
        const { error } = await supabase
          .from('category_rules')
          .insert(rows);

        if (error) {
          console.error('[DataService] Error inserting category rules:', error);
          return rules; // Return original, already saved to localStorage
        }
        console.log('[DataService] Saved', rows.length, 'category rules to Supabase');
      }

      return rules;
    } catch (err) {
      console.error('[DataService] Exception in saveCategoryRules:', err);
      return rules; // Return original, already saved to localStorage
    }
  }

  // Custom Categories
  async getCustomCategories() {
    console.log('[DataService] getCustomCategories called, useSupabase:', this.useSupabase);

    // Always check localStorage first
    const local = loadLocal('cs_customCategories', []);
    console.log('[DataService] localStorage has', local.length, 'custom categories');

    if (!this.useSupabase) {
      return local;
    }

    try {
      const { data, error } = await supabase
        .from('custom_categories')
        .select('name');

      if (error) {
        console.error('[DataService] Error fetching custom categories:', error);
        return local;
      }

      const supabaseCategories = (data || []).map(row => row.name);
      console.log('[DataService] Supabase has', supabaseCategories.length, 'custom categories');

      // If Supabase is empty but localStorage has data, sync localStorage to Supabase
      if (supabaseCategories.length === 0 && local.length > 0) {
        console.log('[DataService] Syncing localStorage custom categories to Supabase...');
        await this.saveCustomCategories(local);
        return local;
      }

      // If Supabase has data, merge with local (unique values)
      if (supabaseCategories.length > 0) {
        const merged = [...new Set([...local, ...supabaseCategories])];
        saveLocal('cs_customCategories', merged);
        return merged;
      }

      return local;
    } catch (err) {
      console.error('[DataService] Exception in getCustomCategories:', err);
      return local;
    }
  }

  async saveCustomCategories(categories) {
    console.log('[DataService] saveCustomCategories called with', categories.length, 'categories, useSupabase:', this.useSupabase);

    // Always save to localStorage as backup
    saveLocal('cs_customCategories', categories);
    console.log('[DataService] Saved custom categories to localStorage backup');

    if (!this.useSupabase) {
      return categories;
    }

    try {
      const { error: deleteError } = await supabase.from('custom_categories').delete().neq('name', '');
      if (deleteError) {
        console.error('[DataService] Error deleting custom categories:', deleteError);
      }

      if (categories.length > 0) {
        const rows = categories.map(name => ({ name }));
        const { error } = await supabase
          .from('custom_categories')
          .insert(rows);

        if (error) {
          console.error('[DataService] Error inserting custom categories:', error);
          return categories; // Return original, already saved to localStorage
        }
        console.log('[DataService] Saved', rows.length, 'custom categories to Supabase');
      }

      return categories;
    } catch (err) {
      console.error('[DataService] Exception in saveCustomCategories:', err);
      return categories; // Return original, already saved to localStorage
    }
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
