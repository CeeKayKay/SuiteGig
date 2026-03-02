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
  const setTransactions = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.transactions) : val;
    setData(prev => ({ ...prev, transactions: newVal }));
    await dataService.saveTransactions(newVal);
  }, []);

  const setInvoices = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.invoices) : val;
    setData(prev => ({ ...prev, invoices: newVal }));
    await dataService.saveInvoices(newVal);
  }, []);

  const setInquiries = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.inquiries) : val;
    setData(prev => ({ ...prev, inquiries: newVal }));
    await dataService.saveInquiries(newVal);
  }, []);

  const setContracts = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.contracts) : val;
    setData(prev => ({ ...prev, contracts: newVal }));
    await dataService.saveContracts(newVal);
  }, []);

  const setEvents = useCallback(async (val) => {
    const newVal = typeof val === 'function' ? val(dataRef.current.events) : val;
    setData(prev => ({ ...prev, events: newVal }));
    await dataService.saveEvents(newVal);
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
    setExpenses,
    setCreditCards,
    setBankAccounts,
    setCategoryRules,
    setCustomCategories,
    setBudgets
  };
}
