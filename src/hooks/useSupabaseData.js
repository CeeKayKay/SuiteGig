import { useState, useEffect, useCallback, useRef } from 'react';
import { dataService } from '../lib/dataService';
import { isSupabaseConfigured } from '../lib/supabase';

// Hook for managing a data collection with Supabase sync
export function useSupabaseData(tableName, localKey, initialValue = []) {
  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial data
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const result = await dataService.getAll(tableName, localKey, initialValue);
        if (mounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
          console.error(`Error loading ${tableName}:`, err);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    // Subscribe to real-time updates
    const unsubscribe = dataService.subscribe(tableName, (payload) => {
      if (payload.eventType === 'INSERT') {
        setData(prev => [payload.new, ...prev.filter(r => r.id !== payload.new.id)]);
      } else if (payload.eventType === 'UPDATE') {
        setData(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
      } else if (payload.eventType === 'DELETE') {
        setData(prev => prev.filter(r => r.id !== payload.old.id));
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [tableName, localKey]);

  // Save handler - debounced sync to Supabase
  const save = useCallback(async (newData) => {
    setData(newData);
    try {
      await dataService.upsertMany(tableName, localKey, newData);
    } catch (err) {
      setError(err);
      console.error(`Error saving ${tableName}:`, err);
    }
  }, [tableName, localKey]);

  return { data, setData: save, loading, error };
}

// Hook for object-based data (budgets, categoryRules)
export function useSupabaseObject(getMethod, saveMethod, localKey, initialValue = {}) {
  const [data, setDataState] = useState(initialValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const result = await getMethod();
        if (mounted) setData(result);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, []);

  const setData = useCallback(async (newData) => {
    setDataState(newData);
    try {
      await saveMethod(newData);
    } catch (err) {
      console.error('Error saving data:', err);
    }
  }, [saveMethod]);

  return { data, setData, loading };
}

// Convenience hook that provides all data at once
export function useSuiteGigData() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    transactions: [],
    invoices: [],
    inquiries: [],
    contracts: [],
    events: [],
    proposals: [],
    expenses: [],
    creditCards: [],
    bankAccounts: [],
    categoryRules: {},
    customCategories: [],
    budgets: {}
  });

  // Use ref to always have access to latest data in callbacks
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    let mounted = true;

    const loadAll = async () => {
      try {
        const [
          transactions,
          invoices,
          inquiries,
          contracts,
          events,
          proposals,
          expenses,
          creditCards,
          bankAccounts,
          categoryRules,
          customCategories,
          budgets
        ] = await Promise.all([
          dataService.getTransactions(),
          dataService.getInvoices(),
          dataService.getInquiries(),
          dataService.getContracts(),
          dataService.getEvents(),
          dataService.getProposals(),
          dataService.getExpenses(),
          dataService.getCreditCards(),
          dataService.getBankAccounts(),
          dataService.getCategoryRules(),
          dataService.getCustomCategories(),
          dataService.getBudgets()
        ]);

        if (mounted) {
          setData({
            transactions,
            invoices,
            inquiries,
            contracts,
            events,
            proposals,
            expenses,
            creditCards,
            bankAccounts,
            categoryRules,
            customCategories,
            budgets
          });
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAll();
    return () => { mounted = false; };
  }, []);

  // Individual setters that sync to Supabase
  // Using dataRef.current to always get latest data
  // All setters save to localStorage first as backup, then try Supabase
  const setTransactions = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.transactions) : val;
    setData(prev => ({ ...prev, transactions: newVal }));
    try {
      localStorage.setItem('cs_transactions', JSON.stringify(newVal));
    } catch (e) { console.warn('Failed to save transactions to localStorage:', e); }
    try {
      await dataService.saveTransactions(newVal);
    } catch (e) { console.warn('Failed to save transactions to Supabase:', e); }
  }, []);

  const setInvoices = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.invoices) : val;
    setData(prev => ({ ...prev, invoices: newVal }));
    try {
      localStorage.setItem('cs_invoices', JSON.stringify(newVal));
    } catch (e) { console.warn('Failed to save invoices to localStorage:', e); }
    try {
      await dataService.saveInvoices(newVal);
    } catch (e) { console.warn('Failed to save invoices to Supabase:', e); }
  }, []);

  const setInquiries = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.inquiries) : val;
    setData(prev => ({ ...prev, inquiries: newVal }));
    // Always save to localStorage first as backup
    try {
      localStorage.setItem('cs_inquiries', JSON.stringify(newVal));
    } catch (e) {
      console.warn('Failed to save inquiries to localStorage:', e);
    }
    // Then try to save to Supabase
    try {
      await dataService.saveInquiries(newVal);
    } catch (e) {
      console.warn('Failed to save inquiries to Supabase:', e);
    }
  }, []);

  const setContracts = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.contracts) : val;
    setData(prev => ({ ...prev, contracts: newVal }));
    try {
      localStorage.setItem('cs_contracts', JSON.stringify(newVal));
    } catch (e) { console.warn('Failed to save contracts to localStorage:', e); }
    try {
      await dataService.saveContracts(newVal);
    } catch (e) { console.warn('Failed to save contracts to Supabase:', e); }
  }, []);

  const setEvents = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.events) : val;
    setData(prev => ({ ...prev, events: newVal }));
    try {
      localStorage.setItem('cs_events', JSON.stringify(newVal));
    } catch (e) { console.warn('Failed to save events to localStorage:', e); }
    try {
      await dataService.saveEvents(newVal);
    } catch (e) { console.warn('Failed to save events to Supabase:', e); }
  }, []);

  const setProposals = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.proposals) : val;
    setData(prev => ({ ...prev, proposals: newVal }));
    try {
      localStorage.setItem('cs_proposals', JSON.stringify(newVal));
    } catch (e) { console.warn('Failed to save proposals to localStorage:', e); }
    try {
      await dataService.saveProposals(newVal);
    } catch (e) { console.warn('Failed to save proposals to Supabase:', e); }
  }, []);

  const setExpenses = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.expenses) : val;
    setData(prev => ({ ...prev, expenses: newVal }));
    await dataService.saveExpenses(newVal);
  }, []);

  const setCreditCards = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.creditCards) : val;
    setData(prev => ({ ...prev, creditCards: newVal }));
    await dataService.saveCreditCards(newVal);
  }, []);

  const setBankAccounts = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.bankAccounts) : val;
    setData(prev => ({ ...prev, bankAccounts: newVal }));
    await dataService.saveBankAccounts(newVal);
  }, []);

  const setCategoryRules = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.categoryRules) : val;
    setData(prev => ({ ...prev, categoryRules: newVal }));
    await dataService.saveCategoryRules(newVal);
  }, []);

  const setCustomCategories = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.customCategories) : val;
    setData(prev => ({ ...prev, customCategories: newVal }));
    await dataService.saveCustomCategories(newVal);
  }, []);

  const setBudgets = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.budgets) : val;
    setData(prev => ({ ...prev, budgets: newVal }));
    await dataService.saveBudgets(newVal);
  }, []);

  return {
    ...data,
    loading,
    isSupabaseConfigured: isSupabaseConfigured(),
    setTransactions,
    setInvoices,
    setInquiries,
    setContracts,
    setEvents,
    setProposals,
    setExpenses,
    setCreditCards,
    setBankAccounts,
    setCategoryRules,
    setCustomCategories,
    setBudgets
  };
}
