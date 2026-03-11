import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import _ from "lodash";
import { useSuiteGigData } from "./hooks/useSupabaseData";
import { isSupabaseConfigured } from "./lib/supabase";
import { dataService } from "./lib/dataService";

// ═══════════════════════════════════════════════════════
// CONSTANTS & DATA
// ═══════════════════════════════════════════════════════

const DEFAULT_EXPENSE_CATEGORIES = [
  "Office Supplies", "Software & Tools", "Marketing", "Travel",
  "Meals & Entertainment", "Professional Services", "Insurance",
  "Rent & Utilities", "Equipment", "Payroll", "Taxes",
  "Vehicle", "Education & Training", "Subscriptions", "Unknown"
];

// Smart merchant patterns for auto-categorization
const MERCHANT_PATTERNS = [
  // Software & Tools
  { patterns: ["adobe", "microsoft", "google", "dropbox", "slack", "zoom", "github", "aws", "amazon web", "digitalocean", "heroku", "netlify", "vercel", "figma", "canva", "notion", "asana", "trello", "jira", "confluence", "hubspot", "mailchimp", "sendgrid", "twilio", "stripe fee", "shopify", "squarespace", "wix", "godaddy", "namecheap", "cloudflare", "openai", "anthropic"], category: "Software & Tools" },
  // Subscriptions
  { patterns: ["netflix", "spotify", "hulu", "disney+", "hbo", "apple music", "youtube premium", "audible", "kindle", "headspace", "calm", "peloton", "subscription", "monthly fee", "annual fee"], category: "Subscriptions" },
  // Office Supplies
  { patterns: ["staples", "office depot", "officemax", "amazon.*office", "uline", "quill", "paper", "ink", "toner", "printer"], category: "Office Supplies" },
  // Travel
  { patterns: ["airline", "united", "delta", "american air", "southwest", "jetblue", "spirit", "frontier", "alaska air", "hotel", "marriott", "hilton", "hyatt", "airbnb", "vrbo", "expedia", "booking.com", "kayak", "uber", "lyft", "taxi", "parking", "toll", "hertz", "enterprise", "avis", "budget rent", "national car"], category: "Travel" },
  // Meals & Entertainment
  { patterns: ["restaurant", "cafe", "coffee", "starbucks", "dunkin", "mcdonald", "wendy", "burger", "pizza", "chipotle", "panera", "subway", "grubhub", "doordash", "uber eats", "postmates", "seamless", "yelp", "opentable", "bar ", "pub ", "grill", "diner", "bistro", "eatery", "kitchen", "bakery", "deli"], category: "Meals & Entertainment" },
  // Marketing
  { patterns: ["facebook ads", "meta ads", "google ads", "linkedin ads", "twitter ads", "tiktok ads", "pinterest ads", "bing ads", "advertising", "marketing", "promo", "campaign", "sponsor", "influencer", "pr ", "public relation", "seo", "sem"], category: "Marketing" },
  // Professional Services
  { patterns: ["legal", "attorney", "lawyer", "law firm", "accountant", "cpa", "bookkeep", "consultant", "freelance", "contractor", "agency", "design service", "developer", "coach", "advisor"], category: "Professional Services" },
  // Insurance
  { patterns: ["insurance", "geico", "state farm", "allstate", "progressive", "liberty mutual", "farmers", "usaa", "nationwide", "travelers", "aetna", "cigna", "blue cross", "united health", "kaiser"], category: "Insurance" },
  // Rent & Utilities
  { patterns: ["rent", "lease", "landlord", "property", "electric", "pg&e", "con edison", "duke energy", "water util", "gas util", "sewage", "trash", "waste", "internet", "comcast", "xfinity", "verizon fios", "at&t", "spectrum", "cox", "centurylink"], category: "Rent & Utilities" },
  // Equipment
  { patterns: ["apple store", "best buy", "b&h photo", "adorama", "newegg", "micro center", "computer", "laptop", "monitor", "keyboard", "mouse", "printer", "scanner", "camera", "equipment", "hardware", "device"], category: "Equipment" },
  // Vehicle
  { patterns: ["gas station", "shell", "chevron", "exxon", "mobil", "bp ", "texaco", "76 ", "arco", "costco gas", "speedway", "wawa", "quiktrip", "car wash", "auto repair", "mechanic", "oil change", "jiffy lube", "valvoline", "firestone", "goodyear", "discount tire", "autozone", "o'reilly", "napa auto", "advance auto", "dmv", "registration"], category: "Vehicle" },
  // Education & Training
  { patterns: ["udemy", "coursera", "skillshare", "linkedin learn", "masterclass", "pluralsight", "treehouse", "codecademy", "edx", "education", "training", "workshop", "seminar", "conference", "webinar", "certification", "course", "tuition", "school", "university", "college", "book", "kindle"], category: "Education & Training" },
];

// Smart categorization function
const smartCategorize = (merchant, userRules = {}) => {
  const normalized = merchant.toLowerCase().trim()
    .replace(/\b\d{5,}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/#\d+/g, "")
    .replace(/\*+/g, " ")
    .replace(/[^a-z0-9\s&]/g, " ")
    .trim();

  // Extract domain from merchant for domain-based matching
  const merchantDomain = extractDomain(merchant);

  // 1. Check user's learned rules first (exact match or domain match)
  for (const [key, cat] of Object.entries(userRules)) {
    const normKey = key.toLowerCase().trim().replace(/\*+/g, " ").replace(/[^a-z0-9\s&]/g, " ").trim();
    if (normalized === normKey || normalized.includes(normKey) || normKey.includes(normalized)) {
      return { category: cat, confidence: "high", source: "learned" };
    }
    // Domain-based matching: if both have the same domain, it's a high-confidence match
    const keyDomain = extractDomain(key);
    if (merchantDomain && keyDomain && merchantDomain === keyDomain) {
      return { category: cat, confidence: "high", source: "learned" };
    }
  }

  // 2. Check common merchant patterns
  for (const { patterns, category } of MERCHANT_PATTERNS) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern.toLowerCase())) {
        return { category, confidence: "medium", source: "pattern" };
      }
    }
  }

  // 3. Check user rules with fuzzy matching (partial word match or domain base match)
  for (const [key, cat] of Object.entries(userRules)) {
    const normKey = key.toLowerCase().trim().replace(/\*+/g, " ").replace(/[^a-z0-9\s&]/g, " ").trim();
    const words = normKey.split(" ").filter(w => w.length > 3);
    if (words.some(word => normalized.includes(word))) {
      return { category: cat, confidence: "low", source: "fuzzy" };
    }
    // Check if domain base from rule matches in merchant (for truncated names)
    const keyDomain = extractDomain(key);
    if (keyDomain) {
      const domainBase = keyDomain.split('.')[0]; // e.g., "vanishingincmagic"
      if (domainBase.length > 5 && normalized.includes(domainBase)) {
        return { category: cat, confidence: "low", source: "fuzzy" };
      }
    }
  }

  return { category: "Unknown", confidence: "none", source: null };
};

const INQUIRY_PHASES = [
  { id: "new", label: "New Lead", color: "#6366f1" },
  { id: "contacted", label: "Contacted", color: "#f59e0b" },
  { id: "proposal", label: "Proposal Sent", color: "#3b82f6" },
  { id: "negotiation", label: "Negotiation", color: "#8b5cf6" },
  { id: "confirmed", label: "Confirmed", color: "#10b981" },
  { id: "released", label: "Released", color: "#ef4444" },
];

const LEAD_GRADES = [
  { grade: "A", color: "#10b981", label: "Hot" },
  { grade: "B", color: "#3b82f6", label: "Warm" },
  { grade: "C", color: "#f59e0b", label: "Cool" },
  { grade: "D", color: "#ef4444", label: "Cold" },
];

const TAX_QUARTERS = [
  { q: "Q1", months: "Jan-Mar", due: "April 30" },
  { q: "Q2", months: "Apr-Jun", due: "July 31" },
  { q: "Q3", months: "Jul-Sep", due: "October 31" },
  { q: "Q4", months: "Oct-Dec", due: "January 31" },
];

const CHECKLIST_QUARTERLY = [
  "File Form 941 (Employer's Quarterly Federal Tax Return)",
  "Pay quarterly estimated federal income tax (Form 1120-S)",
  "File state quarterly withholding returns",
  "Reconcile payroll records",
  "Review and categorize all business expenses",
  "Verify officer reasonable compensation",
  "Update shareholder distribution records",
  "File state unemployment tax returns (SUTA)",
  "Review accounts receivable aging",
  "Backup financial records",
];

const CHECKLIST_ANNUAL = [
  "File Form 1120-S (S Corp Income Tax Return) by March 15",
  "Issue Schedule K-1 to all shareholders",
  "File Form W-2 for all employees by January 31",
  "File Form W-3 (Transmittal of W-2s)",
  "File Form 1099-NEC for contractors ($600+)",
  "File Form 940 (Federal Unemployment Tax)",
  "File state annual reports / franchise tax",
  "Renew business licenses and permits",
  "Review and update corporate minutes",
  "Conduct annual shareholder meeting",
  "Review S Corp election status",
  "Update Articles of Organization if needed",
  "Review officer compensation for reasonableness",
  "Prepare tax prep package for CPA",
  "File BOI Report (Beneficial Ownership Information)",
  "Review health insurance premium deductions",
  "Reconcile all bank and credit card statements",
  "Update depreciation schedules",
];

// ═══════════════════════════════════════════════════════
// SAMPLE DATA GENERATORS
// ═══════════════════════════════════════════════════════

// Generate UUID-compatible IDs for Supabase compatibility
const generateId = () => {
  // Use crypto.randomUUID if available (modern browsers), otherwise generate UUID v4 pattern
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const sampleTransactions = [
  { id: generateId(), date: "2026-02-01", description: "Adobe Creative Cloud", amount: -54.99, category: "Software & Tools", account: "Chase Business CC", reconciled: true },
  { id: generateId(), date: "2026-02-02", description: "Office Depot", amount: -127.43, category: "Office Supplies", account: "Chase Business CC", reconciled: true },
  { id: generateId(), date: "2026-02-03", description: "Client Payment - Acme Corp", amount: 3500.00, category: "Income", account: "Business Checking", reconciled: true },
  { id: generateId(), date: "2026-02-04", description: "Unknown Charge #4821", amount: -89.00, category: "Unknown", account: "Chase Business CC", reconciled: false },
  { id: generateId(), date: "2026-02-05", description: "Google Workspace", amount: -14.40, category: "Software & Tools", account: "Business Checking", reconciled: true },
  { id: generateId(), date: "2026-01-28", description: "Uber - Client Meeting", amount: -34.56, category: "Travel", account: "Chase Business CC", reconciled: true },
  { id: generateId(), date: "2026-01-25", description: "State Farm Insurance", amount: -289.00, category: "Insurance", account: "Business Checking", reconciled: true },
  { id: generateId(), date: "2026-01-20", description: "Mystery payment XREF991", amount: -250.00, category: "Unknown", account: "Chase Business CC", reconciled: false },
];

const sampleCreditCards = [];

const sampleExpenses = [];

const sampleInquiries = [
  { id: generateId(), name: "Johnson Wedding", contact: "Sarah Johnson", email: "sarah@email.com", phone: "555-0101", phase: "new", grade: "A", date: "2026-06-15", value: 8500, notes: "200 guests, outdoor venue", nextSteps: "Send portfolio and pricing guide" },
  { id: generateId(), name: "Tech Summit 2026", contact: "Mike Chen", email: "mike@techsummit.com", phone: "555-0202", phase: "proposal", grade: "B", date: "2026-09-20", value: 15000, notes: "Corporate event, 500 attendees", nextSteps: "Follow up on proposal by Friday" },
  { id: generateId(), name: "Garcia Birthday", contact: "Maria Garcia", email: "maria@email.com", phone: "555-0303", phase: "contacted", grade: "C", date: "2026-04-10", value: 2500, notes: "50th birthday, 75 guests", nextSteps: "Schedule venue walkthrough" },
  { id: generateId(), name: "Annual Gala", contact: "Robert Kim", email: "robert@foundation.org", phone: "555-0404", phase: "negotiation", grade: "A", date: "2026-11-08", value: 25000, notes: "Charity gala, 300 guests, black tie", nextSteps: "Finalize catering contract terms" },
];

const sampleInvoices = [
  { id: generateId(), number: "INV-001", client: "Acme Corp", email: "billing@acme.com", items: [{ desc: "Consulting Services - January", qty: 40, rate: 150 }], status: "paid", date: "2026-01-15", dueDate: "2026-02-15", paidDate: "2026-02-10" },
  { id: generateId(), number: "INV-002", client: "TechStart Inc", email: "ap@techstart.com", items: [{ desc: "Event Planning - Q1", qty: 1, rate: 5000 }], status: "sent", date: "2026-02-01", dueDate: "2026-03-01", paidDate: null },
  { id: generateId(), number: "INV-003", client: "Green Valley LLC", email: "pay@greenvalley.com", items: [{ desc: "Photography Package", qty: 1, rate: 2500 }, { desc: "Photo Editing", qty: 8, rate: 75 }], status: "draft", date: "2026-02-05", dueDate: "2026-03-05", paidDate: null },
];

const sampleEvents = [
  { id: generateId(), name: "Annual Gala", client: "Robert Kim", date: "2026-03-08", time: "18:00", venue: "Grand Ballroom", guests: 300, value: 25000, email: "robert@foundation.org", tasks: [
    { id: generateId(), text: "Confirm catering menu", done: true },
    { id: generateId(), text: "Send final guest list to venue", done: false },
    { id: generateId(), text: "Arrange audio/visual equipment", done: false },
    { id: generateId(), text: "Prepare event timeline", done: false },
  ], emails: [
    { from: "robert@foundation.org", subject: "Gala Menu Preferences", date: "2026-02-01", snippet: "We'd like to go with Option B for the main course..." },
    { from: "robert@foundation.org", subject: "RE: Guest Count Update", date: "2026-02-03", snippet: "Final count is 300 guests, including 20 VIPs..." },
  ]},
  { id: generateId(), name: "Garcia Birthday", client: "Maria Garcia", date: "2026-04-10", time: "14:00", venue: "Riverside Park Pavilion", guests: 75, value: 2500, email: "maria@email.com", tasks: [
    { id: generateId(), text: "Order custom cake", done: false },
    { id: generateId(), text: "Book DJ", done: true },
    { id: generateId(), text: "Arrange balloon decorations", done: false },
  ], emails: [
    { from: "maria@email.com", subject: "Cake Design Ideas", date: "2026-02-04", snippet: "I was thinking of a three-tier gold and white theme..." },
  ]},
];

// ═══════════════════════════════════════════════════════
// ICON COMPONENTS
// ═══════════════════════════════════════════════════════

const Icon = ({ name, size = 18 }) => {
  const icons = {
    dashboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    tax: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 7h6m-6 4h6m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/></svg>,
    bank: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m16-11v11M8 14v3m4-3v3m4-3v3"/></svg>,
    invoice: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h8m-8-8h2"/></svg>,
    inquiry: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm10 0l2 2m-2-2a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    contract: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 18v-6m-3 3l3 3 3-3"/></svg>,
    calendar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
    events: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path d="M9 14l2 2 4-4"/></svg>,
    email: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>,
    payment: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22M6 16h4"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14"/></svg>,
    alert: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
    chevron: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>,
    dollar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1v22m5-18H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H7"/></svg>,
    x: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
    edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    download: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
    sync: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
    star: <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    receipt: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8M8 16h4"/></svg>,
    creditcard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/><path d="M6 16h4m4 0h4"/></svg>,
    repeat: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>,
    piechart: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21.21 15.89A10 10 0 118 2.83"/><path d="M22 12A10 10 0 0012 2v10z"/></svg>,
    ai: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a4 4 0 014 4v1h1a3 3 0 013 3v8a3 3 0 01-3 3H7a3 3 0 01-3-3v-8a3 3 0 013-3h1V6a4 4 0 014-4z"/><circle cx="9" cy="13" r="1.5" fill="currentColor"/><circle cx="15" cy="13" r="1.5" fill="currentColor"/><path d="M9 17h6"/></svg>,
    mic: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8"/></svg>,
    stop: <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>,
    sparkle: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg>,
  };
  return icons[name] || null;
};

// ═══════════════════════════════════════════════════════
// UTILITY COMPONENTS
// ═══════════════════════════════════════════════════════

const Modal = ({ isOpen, onClose, title, children, width = "600px" }) => {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#1a1d23", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", width, maxWidth: "90vw", maxHeight: "85vh", overflow: "auto", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#f0f0f0" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 4 }}>
            <Icon name="x" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Badge = ({ children, color = "#6366f1", style = {} }) => (
  <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${color}22`, color, letterSpacing: "0.02em", ...style }}>
    {children}
  </span>
);

const StatCard = ({ label, value, sub, accent = "#6366f1", icon }) => (
  <div style={{ background: "#1a1d23", borderRadius: 14, padding: "20px 24px", border: "1px solid rgba(255,255,255,0.05)", flex: 1, minWidth: 180 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: accent, marginTop: 4 }}>{sub}</div>}
      </div>
      {icon && <div style={{ color: accent, opacity: 0.6 }}><Icon name={icon} size={24} /></div>}
    </div>
  </div>
);

const Btn = ({ children, onClick, variant = "primary", style = {}, disabled = false, icon }) => {
  const base = { border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.15s", opacity: disabled ? 0.5 : 1, fontFamily: "inherit" };
  const variants = {
    primary: { background: "#6366f1", color: "#fff" },
    secondary: { background: "rgba(255,255,255,0.06)", color: "#ccc", border: "1px solid rgba(255,255,255,0.08)" },
    success: { background: "#10b981", color: "#fff" },
    danger: { background: "#ef4444", color: "#fff" },
    ghost: { background: "transparent", color: "#888", padding: "6px 10px" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{icon && <Icon name={icon} size={14} />}{children}</button>;
};

const Input = ({ label, value, onChange, type = "text", placeholder = "", style = {}, ...rest }) => (
  <div style={{ marginBottom: 14, ...style }}>
    {label && <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 14, fontFamily: "inherit", outline: "none" }}
      {...rest} />
  </div>
);

const Select = ({ label, value, onChange, options, style = {} }) => (
  <div style={{ marginBottom: 14, ...style }}>
    {label && <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 14, fontFamily: "inherit", outline: "none", appearance: "none" }}>
      {options.map(o => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value} style={{ background: "#1e1e2e", color: "#f0f0f0" }}>{typeof o === "string" ? o : o.label}</option>)}
    </select>
  </div>
);

const TextArea = ({ label, value, onChange, rows = 3, placeholder = "" }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>}
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
      style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
  </div>
);

const Table = ({ columns, data, onRowClick }) => (
  <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "rgba(255,255,255,0.03)" }}>
          {columns.map(col => (
            <th key={col.key} style={{ textAlign: col.align || "left", padding: "12px 16px", fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {col.headerRender ? col.headerRender() : col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={row.id || i} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? "pointer" : "default", borderBottom: "1px solid rgba(255,255,255,0.03)" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {columns.map(col => (
              <td key={col.key} style={{ padding: "12px 16px", fontSize: 13, color: "#ccc", textAlign: col.align || "left" }}>
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const formatCurrency = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const formatDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

const loadState = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch { return fallback; }
};

// Extract domain from merchant name if present (e.g., "VANISHINGINCMAGIC.COM VANISHINGINCM NY" -> "vanishingincmagic.com")
const extractDomain = (name) => {
  const match = name.toLowerCase().match(/([a-z0-9-]+\.(?:com|net|org|co|io|shop|store|biz|us|uk|ca))/);
  return match ? match[1] : null;
};

// Normalize merchant name by stripping transaction-specific numbers/IDs
const normalizeMerchant = (name) => {
  return name.toLowerCase().trim()
    .replace(/\b\d{5,}\b/g, "")   // remove long number sequences (transaction IDs)
    .replace(/\s{2,}/g, " ")       // collapse multiple spaces
    .replace(/#\d+/g, "")          // remove #12345 patterns
    .trim();
};

// Check if two merchants match (considering domains and fuzzy matching)
const merchantsMatch = (a, b) => {
  const normA = normalizeMerchant(a);
  const normB = normalizeMerchant(b);

  // Exact match after normalization
  if (normA === normB) return true;

  // Domain-based matching: if both have the same domain, consider them the same merchant
  const domainA = extractDomain(a);
  const domainB = extractDomain(b);
  if (domainA && domainB && domainA === domainB) return true;

  // Fuzzy match: if one domain matches significantly (for truncated names like "VANISHINGINCM")
  if (domainA || domainB) {
    const domain = domainA || domainB;
    const domainBase = domain.split('.')[0]; // e.g., "vanishingincmagic" from "vanishingincmagic.com"
    const other = domainA ? normB : normA;
    // Check if the other name contains the domain base or vice versa
    if (other.includes(domainBase) || domainBase.includes(other.split(' ')[0])) return true;
  }

  return false;
};

const findCategoryRule = (merchant, rules) => {
  for (const [key, cat] of Object.entries(rules)) {
    if (merchantsMatch(merchant, key)) return cat;
  }
  return null;
};

const saveState = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save ${key}:`, e.message);
  }
};

// ── IndexedDB helpers for large data (receipts) ──
const DB_NAME = "suitegig";
const DB_VERSION = 1;
const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => req.result.createObjectStore("receipts");
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const saveReceipt = async (id, data) => {
  try {
    const db = await openDB();
    const tx = db.transaction("receipts", "readwrite");
    tx.objectStore("receipts").put(data, id);
  } catch {}
};

const loadReceipt = async (id) => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction("receipts", "readonly");
      const req = tx.objectStore("receipts").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
};

const deleteReceipt = async (id) => {
  try {
    const db = await openDB();
    const tx = db.transaction("receipts", "readwrite");
    tx.objectStore("receipts").delete(id);
  } catch {}
};

// Save expenses with receipts stripped out (stored separately in IndexedDB)
const saveExpenses = (expenses) => {
  const stripped = expenses.map(e => {
    if (e.receipt && typeof e.receipt === "string" && e.receipt.startsWith("data:")) {
      saveReceipt(e.id, e.receipt);
      return { ...e, receipt: true };
    }
    return e;
  });
  saveState("cs_expenses", stripped);
};

// Load expenses and rehydrate receipts from IndexedDB
const loadExpenses = (fallback) => {
  const expenses = loadState("cs_expenses", fallback);
  // Rehydrate receipts asynchronously
  expenses.forEach(e => {
    if (e.receipt === true) {
      loadReceipt(e.id).then(data => {
        if (data) e.receipt = data;
      });
    }
  });
  return expenses;
};

// ═══════════════════════════════════════════════════════
// SECTION: DASHBOARD
// ═══════════════════════════════════════════════════════

const Dashboard = ({ transactions, invoices, inquiries, events }) => {
  const totalExpenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncome = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const unknownCount = transactions.filter(t => t.category === "Unknown").length;
  const pendingInvoices = invoices.filter(i => i.status === "sent");
  const pendingTotal = pendingInvoices.reduce((s, inv) => s + inv.items.reduce((a, it) => a + it.qty * it.rate, 0), 0);
  const upcomingEvents = events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const hotLeads = inquiries.filter(i => i.grade === "A").length;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: "#888", fontSize: 14 }}>Business overview for {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="Revenue" value={formatCurrency(totalIncome)} sub="This month" accent="#10b981" icon="dollar" />
        <StatCard label="Expenses" value={formatCurrency(totalExpenses)} sub={`${unknownCount} unknown`} accent="#ef4444" icon="bank" />
        <StatCard label="Outstanding" value={formatCurrency(pendingTotal)} sub={`${pendingInvoices.length} invoices`} accent="#f59e0b" icon="invoice" />
        <StatCard label="Hot Leads" value={hotLeads} sub={`${inquiries.length} total inquiries`} accent="#6366f1" icon="inquiry" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 16 }}>Upcoming Events</h3>
          {upcomingEvents.length === 0 ? <p style={{ color: "#666", fontSize: 13 }}>No upcoming events</p> : upcomingEvents.map(ev => (
            <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <div style={{ fontSize: 14, color: "#f0f0f0", fontWeight: 500 }}>{ev.name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{formatDate(ev.date)} · {ev.venue}</div>
              </div>
              <Badge color="#6366f1">{ev.tasks.filter(t => !t.done).length} tasks</Badge>
            </div>
          ))}
        </div>

        <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 16 }}>Tax Calendar</h3>
          {TAX_QUARTERS.map(q => (
            <div key={q.q} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <div style={{ fontSize: 14, color: "#f0f0f0", fontWeight: 500 }}>{q.q}: {q.months}</div>
                <div style={{ fontSize: 12, color: "#888" }}>941 Due: {q.due}</div>
              </div>
              <Badge color="#f59e0b">Upcoming</Badge>
            </div>
          ))}
        </div>

        <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#ef4444" }}><Icon name="alert" size={16} /></span> Alerts
          </h3>
          {unknownCount > 0 && (
            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", borderRadius: 8, marginBottom: 8, border: "1px solid rgba(239,68,68,0.15)" }}>
              <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 500 }}>{unknownCount} unknown transaction{unknownCount > 1 ? "s" : ""} need categorization</div>
            </div>
          )}
          <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.08)", borderRadius: 8, marginBottom: 8, border: "1px solid rgba(245,158,11,0.15)" }}>
            <div style={{ fontSize: 13, color: "#f59e0b", fontWeight: 500 }}>Q1 941 filing due April 30</div>
          </div>
          <div style={{ padding: "10px 14px", background: "rgba(99,102,241,0.08)", borderRadius: 8, border: "1px solid rgba(99,102,241,0.15)" }}>
            <div style={{ fontSize: 13, color: "#6366f1", fontWeight: 500 }}>{pendingInvoices.length} outstanding invoice{pendingInvoices.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 16 }}>Expense Breakdown</h3>
          {Object.entries(_.groupBy(transactions.filter(t => t.amount < 0), "category")).sort((a, b) => b[1].reduce((s, t) => s + Math.abs(t.amount), 0) - a[1].reduce((s, t) => s + Math.abs(t.amount), 0)).slice(0, 5).map(([cat, txs]) => {
            const total = txs.reduce((s, t) => s + Math.abs(t.amount), 0);
            const pct = (total / totalExpenses) * 100;
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: cat === "Unknown" ? "#ef4444" : "#ccc" }}>{cat}</span>
                  <span style={{ color: "#888", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(total)}</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: cat === "Unknown" ? "#ef4444" : "#6366f1", borderRadius: 2, transition: "width 0.5s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: S CORP TAX MANAGEMENT
// ═══════════════════════════════════════════════════════

const TaxManagement = ({ transactions }) => {
  const [activeTab, setActiveTab] = useState("941");
  const [quarterlyChecklist, setQuarterlyChecklist] = useState(CHECKLIST_QUARTERLY.map(item => ({ text: item, done: false })));
  const [annualChecklist, setAnnualChecklist] = useState(CHECKLIST_ANNUAL.map(item => ({ text: item, done: false })));
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");

  const totalExpenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncome = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const tabs = [
    { id: "941", label: "Form 941" },
    { id: "state", label: "State Forms" },
    { id: "quarterly", label: "Quarterly Checklist" },
    { id: "annual", label: "Annual Checklist" },
    { id: "employment", label: "Employment Filings" },
    { id: "taxprep", label: "Tax Prep Package" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>S Corp Tax Management</h1>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>Federal & state compliance, checklists, and tax preparation</p>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: activeTab === t.id ? "#6366f1" : "rgba(255,255,255,0.04)", color: activeTab === t.id ? "#fff" : "#888", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "941" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {TAX_QUARTERS.map(q => (
              <button key={q.q} onClick={() => setSelectedQuarter(q.q)}
                style={{ padding: "6px 14px", borderRadius: 6, border: selectedQuarter === q.q ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.08)", background: selectedQuarter === q.q ? "rgba(99,102,241,0.12)" : "transparent", color: selectedQuarter === q.q ? "#6366f1" : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {q.q}
              </button>
            ))}
          </div>

          <div style={{ background: "#1a1d23", borderRadius: 14, padding: 28, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0", marginBottom: 4 }}>Form 941 — Employer's Quarterly Federal Tax Return</h3>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>{selectedQuarter} ({TAX_QUARTERS.find(q => q.q === selectedQuarter)?.months}) · Due {TAX_QUARTERS.find(q => q.q === selectedQuarter)?.due}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Part 1 — Tax Liability</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#aaa" }}>Line 1: Number of employees</span><span style={{ color: "#f0f0f0", fontFamily: "monospace" }}>___</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#aaa" }}>Line 2: Wages, tips, compensation</span><span style={{ color: "#f0f0f0", fontFamily: "monospace" }}>$_______</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#aaa" }}>Line 3: Federal income tax withheld</span><span style={{ color: "#f0f0f0", fontFamily: "monospace" }}>$_______</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#aaa" }}>Line 5a: Taxable SS wages</span><span style={{ color: "#f0f0f0", fontFamily: "monospace" }}>$_______</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#aaa" }}>Line 5c: Taxable Medicare wages</span><span style={{ color: "#f0f0f0", fontFamily: "monospace" }}>$_______</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#aaa" }}>Line 6: Total taxes before adjustments</span><span style={{ color: "#f0f0f0", fontFamily: "monospace" }}>$_______</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Part 2 — Deposit Schedule</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#aaa" }}>Line 10: Total taxes after adjustments</span><span style={{ color: "#f0f0f0", fontFamily: "monospace" }}>$_______</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#aaa" }}>Line 11: Qualified sick/family leave</span><span style={{ color: "#f0f0f0", fontFamily: "monospace" }}>$_______</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#aaa" }}>Line 12: Total taxes after credits</span><span style={{ color: "#f0f0f0", fontFamily: "monospace" }}>$_______</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#aaa" }}>Line 13: Total deposits for quarter</span><span style={{ color: "#f0f0f0", fontFamily: "monospace" }}>$_______</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#aaa" }}>Line 14: Balance due</span><span style={{ color: "#f0f0f0", fontFamily: "monospace" }}>$_______</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <Btn icon="download">Export 941 Template</Btn>
              <Btn variant="secondary">Auto-fill from Payroll</Btn>
            </div>
          </div>

          <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", marginBottom: 12 }}>Quarter Financial Summary (from Banking)</h4>
            <div style={{ display: "flex", gap: 16 }}>
              <StatCard label="Gross Income" value={formatCurrency(totalIncome)} accent="#10b981" />
              <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} accent="#ef4444" />
              <StatCard label="Net" value={formatCurrency(totalIncome - totalExpenses)} accent="#6366f1" />
            </div>
          </div>
        </div>
      )}

      {activeTab === "state" && (
        <div style={{ background: "#1a1d23", borderRadius: 14, padding: 28, border: "1px solid rgba(255,255,255,0.05)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0", marginBottom: 20 }}>State Tax Form Templates</h3>
          {["State Quarterly Withholding Return", "State Unemployment Tax (SUTA)", "State Sales Tax Return", "State Annual Report / Franchise Tax", "State Income Tax Return"].map((form, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <div style={{ fontSize: 14, color: "#f0f0f0", fontWeight: 500 }}>{form}</div>
                <div style={{ fontSize: 12, color: "#888" }}>Template — customize for your state</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="secondary" icon="download" style={{ fontSize: 12 }}>Download</Btn>
                <Btn variant="ghost" icon="edit" style={{ fontSize: 12 }}>Edit</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {(activeTab === "quarterly" || activeTab === "annual") && (
        <div style={{ background: "#1a1d23", borderRadius: 14, padding: 28, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0" }}>
              {activeTab === "quarterly" ? "Quarterly" : "Annual"} Requirements Checklist
            </h3>
            <Badge color="#10b981">
              {(activeTab === "quarterly" ? quarterlyChecklist : annualChecklist).filter(c => c.done).length}/
              {(activeTab === "quarterly" ? quarterlyChecklist : annualChecklist).length} complete
            </Badge>
          </div>
          {(activeTab === "quarterly" ? quarterlyChecklist : annualChecklist).map((item, i) => (
            <div key={i} onClick={() => {
              const setter = activeTab === "quarterly" ? setQuarterlyChecklist : setAnnualChecklist;
              setter(prev => prev.map((c, j) => j === i ? { ...c, done: !c.done } : c));
            }}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: item.done ? "none" : "2px solid rgba(255,255,255,0.15)", background: item.done ? "#10b981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {item.done && <Icon name="check" size={14} />}
              </div>
              <span style={{ fontSize: 14, color: item.done ? "#666" : "#ccc", textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "employment" && (
        <div style={{ background: "#1a1d23", borderRadius: 14, padding: 28, border: "1px solid rgba(255,255,255,0.05)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0", marginBottom: 20 }}>Employment Filings</h3>
          {[
            { name: "Form W-2", desc: "Wage and Tax Statement — due January 31", status: "upcoming" },
            { name: "Form W-3", desc: "Transmittal of Wage and Tax Statements", status: "upcoming" },
            { name: "Form W-4", desc: "Employee's Withholding Certificate", status: "template" },
            { name: "Form I-9", desc: "Employment Eligibility Verification", status: "template" },
            { name: "Form 1099-NEC", desc: "Nonemployee Compensation — due January 31", status: "upcoming" },
            { name: "Form 940", desc: "Federal Unemployment Tax (FUTA) — annual", status: "upcoming" },
            { name: "Form SS-4", desc: "Application for Employer Identification Number", status: "completed" },
            { name: "New Hire Reporting", desc: "State new hire report within 20 days", status: "template" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <div style={{ fontSize: 14, color: "#f0f0f0", fontWeight: 500 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{f.desc}</div>
              </div>
              <Badge color={f.status === "completed" ? "#10b981" : f.status === "upcoming" ? "#f59e0b" : "#6366f1"}>
                {f.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {activeTab === "taxprep" && (
        <div style={{ background: "#1a1d23", borderRadius: 14, padding: 28, border: "1px solid rgba(255,255,255,0.05)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0", marginBottom: 8 }}>Tax Prep Package</h3>
          <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Compile and organize everything your CPA needs for tax season.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { name: "Profit & Loss Statement", desc: "Auto-generated from banking data", ready: true },
              { name: "Balance Sheet", desc: "Assets, liabilities, equity", ready: false },
              { name: "Bank Statements (All Accounts)", desc: "12-month statements", ready: true },
              { name: "Credit Card Statements", desc: "12-month statements", ready: true },
              { name: "Payroll Records", desc: "W-2s, pay stubs, tax deposits", ready: false },
              { name: "1099 Forms (Sent & Received)", desc: "Contractor payments", ready: false },
              { name: "Depreciation Schedules", desc: "Asset depreciation records", ready: false },
              { name: "Vehicle Mileage Log", desc: "Business miles driven", ready: false },
              { name: "Home Office Deduction", desc: "Square footage, expenses", ready: false },
              { name: "Health Insurance Premiums", desc: "Self-employed health deduction", ready: true },
              { name: "Retirement Contributions", desc: "SEP IRA, Solo 401k, etc.", ready: false },
              { name: "Shareholder Distribution Records", desc: "All distributions to shareholders", ready: true },
            ].map((item, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 10, border: `1px solid ${item.ready ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)"}`, background: item.ready ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: "#f0f0f0", fontWeight: 500 }}>{item.name}</div>
                  {item.ready && <span style={{ color: "#10b981" }}><Icon name="check" size={16} /></span>}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
            <Btn variant="success" icon="download">Export Full Package (.zip)</Btn>
            <Btn variant="secondary">Send to CPA</Btn>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: BANKING / EXPENSES
// ═══════════════════════════════════════════════════════

const Banking = ({ transactions, setTransactions, bankAccounts = [], setBankAccounts, expenseCategories = DEFAULT_EXPENSE_CATEGORIES }) => {
  const [filter, setFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [editingTx, setEditingTx] = useState(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("checking");
  const [newAccountLast4, setNewAccountLast4] = useState("");
  const [newAccountBalance, setNewAccountBalance] = useState("");

  const unknownTxs = transactions.filter(t => t.category === "Unknown");
  const filtered = transactions.filter(t => {
    if (filter === "unknown") return t.category === "Unknown";
    if (filter === "income") return t.amount > 0;
    if (filter === "expenses") return t.amount < 0;
    return true;
  }).filter(t => searchQ === "" || t.description.toLowerCase().includes(searchQ.toLowerCase()));

  const handleCategorize = (id, category) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, category } : t));
    setEditingTx(null);
  };

  const handleAddAccount = () => {
    if (!newAccountName.trim()) return;
    const account = {
      id: generateId(),
      name: newAccountName.trim(),
      type: newAccountType,
      last_four: newAccountLast4,
      balance: parseFloat(newAccountBalance) || 0,
      color: newAccountType === "checking" ? "#3b82f6" : newAccountType === "savings" ? "#10b981" : "#f59e0b"
    };
    setBankAccounts(prev => [...prev, account]);
    setNewAccountName("");
    setNewAccountType("checking");
    setNewAccountLast4("");
    setNewAccountBalance("");
    setShowAddAccount(false);
  };

  const handleDeleteAccount = (id) => {
    if (confirm("Are you sure you want to delete this account?")) {
      setBankAccounts(prev => prev.filter(a => a.id !== id));
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Banking & Expenses</h1>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>Track, categorize, and reconcile transactions</p>

      {unknownTxs.length > 0 && (
        <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#ef4444" }}><Icon name="alert" size={20} /></span>
          <div>
            <div style={{ fontSize: 14, color: "#ef4444", fontWeight: 600 }}>{unknownTxs.length} Unknown Transaction{unknownTxs.length > 1 ? "s" : ""}</div>
            <div style={{ fontSize: 12, color: "#888" }}>These transactions need to be categorized for accurate tax reporting.</div>
          </div>
        </div>
      )}

      {/* Bank Accounts Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0" }}>Bank Accounts</h3>
          <Btn variant="primary" icon="plus" onClick={() => setShowAddAccount(true)}>Add Account</Btn>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {bankAccounts.length === 0 ? (
            <div style={{ flex: 1, background: "#1a1d23", borderRadius: 10, padding: 24, border: "1px dashed rgba(255,255,255,0.1)", textAlign: "center" }}>
              <div style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>No bank accounts added yet</div>
              <Btn variant="secondary" icon="plus" onClick={() => setShowAddAccount(true)}>Add Your First Account</Btn>
            </div>
          ) : (
            bankAccounts.map(account => (
              <div key={account.id} style={{ flex: "1 1 280px", maxWidth: 350, background: "#1a1d23", borderRadius: 10, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${account.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: account.color }}>
                  <Icon name={account.type === "credit" ? "payment" : "bank"} size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#888", textTransform: "capitalize" }}>{account.type}{account.last_four ? ` ••${account.last_four}` : ""}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{account.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: account.balance >= 0 ? "#f0f0f0" : "#ef4444", fontFamily: "monospace" }}>{formatCurrency(account.balance)}</div>
                </div>
                <button onClick={() => handleDeleteAccount(account.id)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: 4 }} title="Delete account">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ id: "all", label: "All" }, { id: "income", label: "Income" }, { id: "expenses", label: "Expenses" }, { id: "unknown", label: "⚠ Unknown" }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: filter === f.id ? "#6366f1" : "rgba(255,255,255,0.04)", color: filter === f.id ? "#fff" : "#888", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search transactions..."
            style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px 8px 34px", color: "#f0f0f0", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#666" }}><Icon name="search" size={14} /></span>
        </div>
        <Btn variant="secondary" icon="sync">Sync Accounts</Btn>
      </div>

      <Table
        columns={[
          { key: "date", label: "Date", render: r => formatDate(r.date) },
          { key: "description", label: "Description" },
          { key: "account", label: "Account", render: r => <span style={{ fontSize: 12, color: "#888" }}>{r.account}</span> },
          { key: "category", label: "Category", render: r => (
            <span onClick={e => { e.stopPropagation(); setEditingTx(r.id); }} style={{ cursor: "pointer" }}>
              <Badge color={r.category === "Unknown" ? "#ef4444" : r.category === "Income" ? "#10b981" : "#6366f1"}>{r.category}</Badge>
            </span>
          )},
          { key: "amount", label: "Amount", align: "right", render: r => (
            <span style={{ color: r.amount > 0 ? "#10b981" : "#ef4444", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
              {r.amount > 0 ? "+" : ""}{formatCurrency(r.amount)}
            </span>
          )},
          { key: "reconciled", label: "✓", align: "center", render: r => r.reconciled ? <span style={{ color: "#10b981" }}>✓</span> : <span style={{ color: "#666" }}>–</span> },
        ]}
        data={filtered}
      />

      {/* Categorize Transaction Modal */}
      <Modal isOpen={editingTx !== null} onClose={() => setEditingTx(null)} title="Categorize Transaction" width="400px">
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>Select a category for this transaction:</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {expenseCategories.filter(c => c !== "Unknown").map(cat => (
            <button key={cat} onClick={() => handleCategorize(editingTx, cat)}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#ccc", fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              {cat}
            </button>
          ))}
        </div>
      </Modal>

      {/* Add Account Modal */}
      <Modal isOpen={showAddAccount} onClose={() => setShowAddAccount(false)} title="Add Bank Account" width="400px">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Account Name</label>
            <input value={newAccountName} onChange={e => setNewAccountName(e.target.value)} placeholder="e.g., Business Checking"
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Account Type</label>
            <select value={newAccountType} onChange={e => setNewAccountType(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", background: "#1a1d23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 14, fontFamily: "inherit", outline: "none" }}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit Card</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Last 4 Digits (optional)</label>
            <input value={newAccountLast4} onChange={e => setNewAccountLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" maxLength={4}
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Current Balance</label>
            <input value={newAccountBalance} onChange={e => setNewAccountBalance(e.target.value)} placeholder="0.00" type="number" step="0.01"
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowAddAccount(false)} style={{ flex: 1 }}>Cancel</Btn>
            <Btn variant="primary" onClick={handleAddAccount} style={{ flex: 1 }}>Add Account</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: EXPENSES
// ═══════════════════════════════════════════════════════

const Expenses = ({ expenses, setExpenses, creditCards, setCreditCards, budgets, setBudgets, categoryRules, setCategoryRules, expenseCategories, customCategories, setCustomCategories }) => {
  const [subTab, setSubTab] = useState("feed");
  const [cardFilter, setCardFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [sortBy, setSortBy] = useState("date"); // "date" | "amount" | "merchant" | "category"
  const [sortDir, setSortDir] = useState("desc"); // "asc" | "desc"
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editCategory, setEditCategory] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReceipt, setEditReceipt] = useState(null);
  const [editRecurring, setEditRecurring] = useState("none"); // "none" | "monthly" | "yearly"
  const [applyToAll, setApplyToAll] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMonth, setExportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  // Add expense
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newMerchant, setNewMerchant] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("Unknown");
  const [newCard, setNewCard] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [newNotes, setNewNotes] = useState("");
  // CSV Import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState("choose"); // "choose" | "csv" | "pdf"
  const [csvData, setCsvData] = useState([]);
  const [csvColumns, setCsvColumns] = useState([]);
  const [csvMapping, setCsvMapping] = useState({ date: "", merchant: "", amount: "", category: "" });
  const [csvCard, setCsvCard] = useState("");
  // PDF Import (supports multiple files)
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfParsed, setPdfParsed] = useState([]);
  const [pdfCard, setPdfCard] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [pdfFileNames, setPdfFileNames] = useState([]);
  const [pdfExcluded, setPdfExcluded] = useState(new Set());
  // Bulk select
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Manual card add
  const [manualBrand, setManualBrand] = useState("");
  const [manualLast4, setManualLast4] = useState("");
  const [manualColor, setManualColor] = useState("#6366f1");
  // Budget
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetCat, setBudgetCat] = useState("");
  const [budgetAmt, setBudgetAmt] = useState("");
  // Plaid
  const [plaidAvailable, setPlaidAvailable] = useState(false);
  const [plaidStatus, setPlaidStatus] = useState("");
  const receiptInputRef = useRef(null);

  // Plaid check on mount
  useEffect(() => {
    fetch("/api/plaid/status").then(r => { if (r.ok) setPlaidAvailable(true); }).catch(() => {});
  }, []);

  // Force sync to cloud
  const handleSyncToCloud = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await dataService.forceSyncToCloud();
      setSyncResult(result);
      if (result.success) {
        setTimeout(() => setSyncResult(null), 3000);
      }
    } catch (err) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  };

  // Stats - dynamic month
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonth = expenses.filter(e => e.date.startsWith(currentMonth));
  const monthTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
  const confirmedRecurring = expenses.filter(e => e.recurring && e.recurring !== "none" && e.recurring !== false);
  const recurringExpenses = confirmedRecurring; // Alias for compatibility
  const recurringTotal = confirmedRecurring.reduce((s, e) => s + (e.recurring === "yearly" ? e.amount / 12 : e.amount), 0);

  // Detect potential recurring expenses automatically
  const detectRecurring = useMemo(() => {
    const groups = {};
    expenses.forEach(exp => {
      // Normalize merchant name for grouping
      const key = normalizeMerchant(exp.merchant);
      if (!groups[key]) groups[key] = [];
      groups[key].push(exp);
    });

    const detected = [];
    Object.entries(groups).forEach(([merchantKey, items]) => {
      if (items.length < 2) return; // Need at least 2 occurrences

      // Group by similar amounts (within 5% tolerance)
      const amountGroups = {};
      items.forEach(item => {
        const roundedAmount = Math.round(item.amount);
        const matchingKey = Object.keys(amountGroups).find(k => {
          const diff = Math.abs(parseFloat(k) - item.amount);
          return diff / item.amount < 0.05; // 5% tolerance
        });
        const key = matchingKey || String(roundedAmount);
        if (!amountGroups[key]) amountGroups[key] = [];
        amountGroups[key].push(item);
      });

      Object.entries(amountGroups).forEach(([amtKey, amtItems]) => {
        if (amtItems.length < 2) return;

        // Sort by date to analyze frequency
        const sorted = [...amtItems].sort((a, b) => a.date.localeCompare(b.date));
        const dates = sorted.map(e => new Date(e.date));

        // Calculate average days between occurrences
        let totalDays = 0;
        for (let i = 1; i < dates.length; i++) {
          totalDays += (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
        }
        const avgDays = totalDays / (dates.length - 1);

        // Determine frequency: monthly (25-35 days) or yearly (340-400 days)
        let frequency = null;
        if (avgDays >= 25 && avgDays <= 40) frequency = "monthly";
        else if (avgDays >= 340 && avgDays <= 400) frequency = "yearly";
        else if (avgDays >= 80 && avgDays <= 100) frequency = "quarterly"; // ~90 days

        if (frequency && sorted.some(e => !e.recurring || e.recurring === "none" || e.recurring === false)) {
          const avgAmount = amtItems.reduce((s, e) => s + e.amount, 0) / amtItems.length;
          detected.push({
            merchantKey,
            merchant: sorted[0].merchant,
            items: sorted,
            frequency,
            avgAmount,
            avgDays: Math.round(avgDays),
            count: amtItems.length,
            lastDate: sorted[sorted.length - 1].date,
          });
        }
      });
    });

    return detected.sort((a, b) => b.avgAmount - a.avgAmount);
  }, [expenses]);
  const needsReview = expenses.filter(e => e.status === "needs_review").length;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysSoFar = Math.max(now.getDate(), 1);
  const dailyAvg = monthTotal / daysSoFar;

  // Filtered and sorted expenses
  const filtered = expenses.filter(e => {
    if (cardFilter !== "all" && e.cardLast4 !== cardFilter) return false;
    if (catFilter !== "all" && e.category !== catFilter) return false;
    if (searchQ && !e.merchant.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    let cmp = 0;
    if (sortBy === "date") cmp = a.date.localeCompare(b.date);
    else if (sortBy === "amount") cmp = a.amount - b.amount;
    else if (sortBy === "merchant") cmp = a.merchant.localeCompare(b.merchant);
    else if (sortBy === "category") cmp = a.category.localeCompare(b.category);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir(field === "date" || field === "amount" ? "desc" : "asc");
    }
  };

  // Categories in use
  const usedCategories = [...new Set(expenses.map(e => e.category))].sort();

  // Spending by category
  const spendingByCategory = _.groupBy(expenses, "category");
  const categoryTotals = Object.entries(spendingByCategory).map(([cat, items]) => ({
    category: cat,
    total: items.reduce((s, e) => s + e.amount, 0),
    count: items.length,
  })).sort((a, b) => b.total - a.total);
  const maxCategoryTotal = categoryTotals[0]?.total || 1;

  // Spending by card
  const spendingByCard = _.groupBy(expenses, "cardLast4");
  const cardTotals = Object.entries(spendingByCard).map(([last4, items]) => ({
    last4,
    card: creditCards.find(c => c.last4 === last4),
    total: items.reduce((s, e) => s + e.amount, 0),
    count: items.length,
  }));

  // Top merchants
  const merchantGroups = _.groupBy(expenses, "merchant");
  const topMerchants = Object.entries(merchantGroups).map(([m, items]) => ({
    merchant: m,
    total: items.reduce((s, e) => s + e.amount, 0),
    count: items.length,
  })).sort((a, b) => b.total - a.total).slice(0, 5);

  // ── Expense Detail ──
  const openExpenseDetail = (exp) => {
    setEditingExpense(exp);
    setEditCategory(exp.category);
    setEditNotes(exp.notes || "");
    setEditReceipt(exp.receipt || null);
    setEditRecurring(exp.recurring === true ? "monthly" : (exp.recurring || "none")); // Handle legacy boolean
    setApplyToAll(false);
  };

  const handleCustomCategory = (currentValue, setter) => {
    const name = prompt("Enter new category name:")?.trim();
    if (!name) { setter(currentValue); return; }
    if (expenseCategories.includes(name)) { setter(name); return; }
    setCustomCategories(prev => [...prev, name]);
    setter(name);
  };

  const applyRuleNow = (cat) => {
    if (!editingExpense || cat === "Unknown") return;
    const merchantKey = normalizeMerchant(editingExpense.merchant);
    setExpenses(prev => prev.map(e => {
      if (e.id === editingExpense.id) return e;
      if (merchantsMatch(e.merchant, editingExpense.merchant)) {
        return { ...e, category: cat, status: "categorized" };
      }
      return e;
    }));
    setCategoryRules(prev => ({ ...prev, [merchantKey]: cat }));
  };

  const saveExpenseDetail = () => {
    setExpenses(prev => prev.map(e => e.id === editingExpense.id ? {
      ...e, category: editCategory, notes: editNotes, receipt: editReceipt,
      recurring: editRecurring === "none" ? false : editRecurring,
      status: editCategory !== "Unknown" ? "categorized" : "needs_review"
    } : e));
    setEditingExpense(null);
  };

  // Confirm detected recurring expenses
  const confirmRecurring = (detected, frequency) => {
    const ids = new Set(detected.items.map(e => e.id));
    setExpenses(prev => prev.map(e => ids.has(e.id) ? { ...e, recurring: frequency } : e));
  };

  // Dismiss detected recurring (mark as non-recurring)
  const dismissRecurring = (detected) => {
    const ids = new Set(detected.items.map(e => e.id));
    setExpenses(prev => prev.map(e => ids.has(e.id) ? { ...e, recurring: "dismissed" } : e));
  };

  const handleReceiptUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Receipt too large (max 5MB)"); return; }
    const reader = new FileReader();
    reader.onload = (evt) => setEditReceipt(evt.target.result);
    reader.readAsDataURL(file);
  };

  // ── Add Expense ──
  const handleAddExpense = () => {
    if (!newMerchant || !newAmount) return;
    setExpenses(prev => [{
      id: generateId(), date: newDate, merchant: newMerchant,
      amount: Math.abs(parseFloat(newAmount) || 0),
      category: newCategory, cardLast4: newCard || "manual",
      recurring: newRecurring, receipt: null, notes: newNotes,
      status: newCategory !== "Unknown" ? "categorized" : "needs_review",
    }, ...prev]);
    setShowAddModal(false);
    setNewMerchant(""); setNewAmount(""); setNewCategory("Unknown");
    setNewCard(""); setNewRecurring(false); setNewNotes("");
    setNewDate(new Date().toISOString().split("T")[0]);
  };

  // ── Delete ──
  const deleteExpense = (id) => {
    deleteReceipt(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    setEditingExpense(null);
  };

  const bulkDelete = () => {
    if (!window.confirm(`Delete ${selectedIds.size} expense(s)?`)) return;
    selectedIds.forEach(id => deleteReceipt(id));
    setExpenses(prev => prev.filter(e => !selectedIds.has(e.id)));
    setSelectedIds(new Set());
  };

  const bulkAssignCard = (cardLast4) => {
    if (!cardLast4) return;
    setExpenses(prev => prev.map(e => selectedIds.has(e.id) ? { ...e, cardLast4 } : e));
    setSelectedIds(new Set());
  };

  const toggleSelect = (id, e) => {
    e?.stopPropagation();
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(e => e.id)));
  };

  // ── CSV Import ──
  const parseCSV = (text) => {
    const lines = [];
    let cur = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') inQ = !inQ;
      else if ((ch === '\n' || ch === '\r') && !inQ) { if (cur.trim()) lines.push(cur); cur = ""; }
      else cur += ch;
    }
    if (cur.trim()) lines.push(cur);
    return lines.map(line => {
      const fields = []; let f = "", q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') q = !q;
        else if (c === ',' && !q) { fields.push(f.trim()); f = ""; }
        else f += c;
      }
      fields.push(f.trim());
      return fields;
    });
  };

  const handleCSVFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const parsed = parseCSV(evt.target.result);
      if (parsed.length < 2) return;
      const headers = parsed[0];
      const rows = parsed.slice(1).filter(r => r.length >= 2);
      setCsvColumns(headers);
      setCsvData(rows);
      // Auto-detect column mapping
      const m = { date: "", merchant: "", amount: "", category: "" };
      headers.forEach((h, i) => {
        const lh = h.toLowerCase();
        if ((lh.includes("date") || lh === "posting date" || lh === "trans date") && !m.date) m.date = String(i);
        if ((lh.includes("description") || lh.includes("merchant") || lh.includes("name") || lh === "memo") && !m.merchant) m.merchant = String(i);
        if ((lh.includes("amount") || lh.includes("total") || lh === "debit") && !m.amount) m.amount = String(i);
        if ((lh.includes("category") || lh.includes("type")) && !m.category) m.category = String(i);
      });
      setCsvMapping(m);
    };
    reader.readAsText(file);
  };

  const normalizeDate = (raw) => {
    if (!raw) return new Date().toISOString().split("T")[0];
    // Handle MM/DD/YYYY or MM-DD-YYYY
    const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (slashMatch) {
      const yr = slashMatch[3].length === 2 ? "20" + slashMatch[3] : slashMatch[3];
      return `${yr}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
    }
    // Handle YYYY-MM-DD already
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // Try native parse
    const d = new Date(raw);
    return isNaN(d) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0];
  };

  // Preview CSV data with smart categorization
  const csvPreview = useMemo(() => {
    if (!csvData.length || !csvMapping.date || !csvMapping.merchant || !csvMapping.amount) return [];
    return csvData.slice(0, 100).map(row => {
      const rawAmt = row[parseInt(csvMapping.amount)] || "0";
      const amount = Math.abs(parseFloat(rawAmt.replace(/[^0-9.\-]/g, "")) || 0);
      if (amount === 0) return null;
      const merchant = row[parseInt(csvMapping.merchant)] || "Unknown Merchant";
      const csvCat = csvMapping.category ? (row[parseInt(csvMapping.category)] || "") : "";
      const smart = smartCategorize(merchant, categoryRules);
      const category = csvCat && csvCat !== "Unknown" ? csvCat : smart.category;
      return {
        date: normalizeDate(row[parseInt(csvMapping.date)]),
        merchant,
        amount,
        category,
        confidence: csvCat && csvCat !== "Unknown" ? "csv" : smart.confidence,
        source: csvCat && csvCat !== "Unknown" ? "csv" : smart.source,
      };
    }).filter(Boolean);
  }, [csvData, csvMapping, categoryRules]);

  const handleImportCSV = () => {
    const card = csvCard || creditCards[0]?.last4 || "manual";
    const imported = csvData.map(row => {
      const rawAmt = row[parseInt(csvMapping.amount)] || "0";
      const amount = Math.abs(parseFloat(rawAmt.replace(/[^0-9.\-]/g, "")) || 0);
      if (amount === 0) return null;
      const merchant = row[parseInt(csvMapping.merchant)] || "Unknown Merchant";
      const csvCat = csvMapping.category ? (row[parseInt(csvMapping.category)] || "") : "";
      const smart = smartCategorize(merchant, categoryRules);
      const category = csvCat && csvCat !== "Unknown" ? csvCat : smart.category;
      return {
        id: generateId(),
        date: normalizeDate(row[parseInt(csvMapping.date)]),
        merchant, amount, category,
        cardLast4: card,
        recurring: false, receipt: null,
        notes: smart.source ? `Auto-categorized (${smart.source})` : "Imported from CSV",
        status: category !== "Unknown" ? "categorized" : "needs_review",
      };
    }).filter(Boolean);

    // Learn new rules from this import (for merchants we auto-categorized)
    const newRules = { ...categoryRules };
    imported.forEach(exp => {
      if (exp.category !== "Unknown" && !categoryRules[exp.merchant]) {
        newRules[exp.merchant] = exp.category;
      }
    });
    if (Object.keys(newRules).length > Object.keys(categoryRules).length) {
      setCategoryRules(newRules);
    }

    setExpenses(prev => [...imported, ...prev]);
    setShowImportModal(false); setImportMode("choose");
    setCsvData([]); setCsvColumns([]); setCsvMapping({ date: "", merchant: "", amount: "", category: "" });
  };

  // ── PDF Import ──
  const loadPdfJs = async () => {
    if (window.pdfjsLib) return window.pdfjsLib;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      s.onerror = () => reject(new Error("Failed to load PDF.js"));
      document.head.appendChild(s);
    });
  };

  const extractPdfText = async (file) => {
    const lib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Group text items by Y position to reconstruct lines
      const items = content.items.filter(it => it.str.trim());
      const lineMap = {};
      items.forEach(it => {
        // Round Y to group items on the same line (within 2px tolerance)
        const y = Math.round(it.transform[5] / 2) * 2;
        if (!lineMap[y]) lineMap[y] = [];
        lineMap[y].push({ text: it.str, x: it.transform[4] });
      });
      // Sort lines top-to-bottom (higher Y = higher on page), items left-to-right
      const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
      sortedYs.forEach(y => {
        const lineItems = lineMap[y].sort((a, b) => a.x - b.x);
        const lineText = lineItems.map(it => it.text).join("  ").trim();
        if (lineText) pages.push(lineText);
      });
    }
    return pages;
  };

  const parseStatementLines = (lines) => {
    // ── Step 1: Detect statement year/period from metadata ──
    let openMonth = null, openYear = null, closeMonth = null, closeYear = null;
    for (const line of lines) {
      // "Opening/Closing Date  01/05/25 - 02/04/25" or similar period lines
      const periodMatch = line.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[-–—to]+\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (periodMatch) {
        openMonth = parseInt(periodMatch[1]);
        openYear = periodMatch[3].length === 2 ? 2000 + parseInt(periodMatch[3]) : parseInt(periodMatch[3]);
        closeMonth = parseInt(periodMatch[4]);
        closeYear = periodMatch[6].length === 2 ? 2000 + parseInt(periodMatch[6]) : parseInt(periodMatch[6]);
        break;
      }
      // "Statement Date: 02/04/25" or "Statement Date  02/04/25"
      const stmtMatch = line.match(/statement\s*date[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
      if (stmtMatch) {
        closeMonth = parseInt(stmtMatch[1]);
        closeYear = stmtMatch[3].length === 2 ? 2000 + parseInt(stmtMatch[3]) : parseInt(stmtMatch[3]);
        break;
      }
    }
    // Fallback: look for "Month YYYY" like "January 2025" or "March 2025"
    if (!closeYear) {
      const monthNames = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
      for (const line of lines) {
        const m = line.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
        if (m) { closeYear = parseInt(m[2]); closeMonth = monthNames[m[1].slice(0,3).toLowerCase()]; break; }
      }
    }
    // Fallback: look for embedded date like "25/02/04" (YY/MM/DD) common in Chase footers
    if (!closeYear) {
      for (const line of lines) {
        const m = line.match(/(\d{2})\/(\d{2})\/(\d{2})\s+Page\s+\d/);
        if (m) { closeYear = 2000 + parseInt(m[1]); closeMonth = parseInt(m[2]); break; }
      }
    }
    if (!closeYear) closeYear = new Date().getFullYear();
    if (!openYear) openYear = closeYear;

    // Determine the correct year for a given transaction month
    const getYearForMonth = (txMonth) => {
      // Cross-year statement (e.g., Dec 2024 → Jan 2025)
      if (openMonth && closeMonth && openMonth > closeMonth) {
        return txMonth >= openMonth ? openYear : closeYear;
      }
      // Same-year statement — but handle edge case: if openYear < closeYear
      // (e.g., statement opened in Dec 2024, closes Jan 2025)
      if (openYear && closeYear && openYear < closeYear) {
        return txMonth >= (openMonth || 1) ? openYear : closeYear;
      }
      return closeYear;
    };

    // ── Step 2: Parse transaction lines ──
    const transactions = [];
    const datePatterns = [
      { re: /^(\d{1,2}\/\d{1,2}\/\d{2,4})/, hasYear: true },    // MM/DD/YYYY or MM/DD/YY
      { re: /^(\d{1,2}\/\d{1,2})\s/, hasYear: false },            // MM/DD (no year)
      { re: /^(\d{1,2}-\d{1,2}-\d{2,4})/, hasYear: true },        // MM-DD-YYYY
      { re: /^(\w{3}\s+\d{1,2},?\s*\d{4})/, hasYear: true },      // Jan 15, 2025
      { re: /^(\d{4}-\d{2}-\d{2})/, hasYear: true },               // YYYY-MM-DD
    ];
    const amountPattern = /[-−]?\$?\s*[\d,]+\.\d{2}/g;
    const skipPatterns = [
      /account\s*(number|summary)|page\s+\d+\s+of/i,
      /^(balance|total|subtotal|minimum|payment\s+due|credit\s+limit|available|previous|new\s+balance)/i,
      /^(date\s+of|trans\s+date|post\s+date|description|reference|merchant\s+name|amount|\$\s*amount|debit|details)\s/i,
      /customer\s+service|cardmember|member\s+since|reward|points?\s+(balance|available|earned)/i,
      /opening\/closing|statement\s*date|annual\s+percentage|interest\s+charge|billing\s+period/i,
      /year-to-date|totals?\s+year|fees?\s+charged\s+in/i,
      /^PAYMENTS\s+AND|^PURCHASE\s*$|^ACCOUNT\s+ACTIVITY/i,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length < 8 || skipPatterns.some(p => p.test(line))) continue;

      // Try to match a date at the start of the line
      let dateStr = null;
      let dateEnd = 0;
      let dateHasYear = false;
      for (const dp of datePatterns) {
        const m = line.match(dp.re);
        if (m) {
          dateStr = m[1];
          dateEnd = m.index + m[0].length;
          dateHasYear = dp.hasYear;
          break;
        }
      }
      if (!dateStr) continue;

      // Build full date with year
      let fullDateStr = dateStr;
      if (!dateHasYear) {
        // dateStr is "MM/DD" — attach the correct year
        const txMonth = parseInt(dateStr.split("/")[0]);
        const yr = getYearForMonth(txMonth);
        fullDateStr = `${dateStr}/${yr}`;
      }

      // Find all dollar amounts on the line — take the last one
      const amounts = [];
      let am;
      while ((am = amountPattern.exec(line)) !== null) {
        amounts.push({ value: am[0], index: am.index });
      }
      amountPattern.lastIndex = 0;
      if (amounts.length === 0) continue;

      const lastAmt = amounts[amounts.length - 1];
      const rawAmt = lastAmt.value.replace(/[−]/g, "-").replace(/[$,\s]/g, "");
      const amount = parseFloat(rawAmt);
      if (isNaN(amount) || amount === 0) continue;

      // Description: everything between the date and the last amount
      let desc = line.substring(dateEnd, lastAmt.index).trim();

      // Skip post date if present (second date right after first)
      const postDateMatch = desc.match(/^\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*/);
      if (postDateMatch) desc = desc.substring(postDateMatch[0].length).trim();

      // Clean description
      desc = desc.replace(/^\d{4,}\s+/, "").replace(/\s{2,}/g, " ").trim();

      if (!desc || desc.length < 2) continue;
      if (Math.abs(amount) > 100000) continue;

      transactions.push({
        id: generateId(),
        date: normalizeDate(fullDateStr),
        merchant: desc,
        amount: Math.abs(amount),
        isCredit: amount < 0 || /payment|credit|refund/i.test(desc),
      });
    }
    return transactions;
  };

  const handlePdfFile = async (e, append = false) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPdfError(""); setPdfParsing(true);
    if (!append) { setPdfParsed([]); setPdfFileNames([]); setPdfExcluded(new Set()); }
    const errors = [];
    const allTransactions = append ? [...pdfParsed] : [];
    const allNames = append ? [...pdfFileNames] : [];
    for (const file of files) {
      try {
        const lines = await extractPdfText(file);
        if (lines.length === 0) { errors.push(`${file.name}: No text found (may be scanned/image-based)`); continue; }
        const transactions = parseStatementLines(lines);
        if (transactions.length === 0) { errors.push(`${file.name}: No transactions detected`); continue; }
        transactions.forEach(t => t.source = file.name);
        allTransactions.push(...transactions);
        allNames.push(file.name);
      } catch (err) {
        errors.push(`${file.name}: ${err.message || "Failed to parse"}`);
      }
    }
    if (allTransactions.length > 0) {
      setPdfParsed(allTransactions);
      setPdfFileNames(allNames);
      setImportMode("pdf");
    }
    if (errors.length > 0) setPdfError(errors.join("\n"));
    setPdfParsing(false);
    e.target.value = "";
  };

  const togglePdfRow = (id) => {
    setPdfExcluded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleImportPdf = () => {
    const card = pdfCard || creditCards[0]?.last4 || "manual";
    const toImport = pdfParsed
      .filter(t => !pdfExcluded.has(t.id) && !t.isCredit)
      .map(t => {
        const smart = smartCategorize(t.merchant, categoryRules);
        return {
          id: generateId(), date: t.date, merchant: t.merchant, amount: t.amount,
          category: smart.category, cardLast4: card, recurring: false, receipt: null,
          notes: smart.source ? `Auto-categorized (${smart.source})` : `Imported from ${t.source || pdfFileNames.join(", ")}`,
          status: smart.category !== "Unknown" ? "categorized" : "needs_review",
        };
      });

    // Learn new rules from this import
    const newRules = { ...categoryRules };
    toImport.forEach(exp => {
      if (exp.category !== "Unknown" && !categoryRules[exp.merchant]) {
        newRules[exp.merchant] = exp.category;
      }
    });
    if (Object.keys(newRules).length > Object.keys(categoryRules).length) {
      setCategoryRules(newRules);
    }

    setExpenses(prev => [...toImport, ...prev]);
    setShowImportModal(false); setImportMode("choose");
    setPdfParsed([]); setPdfFileNames([]);
  };

  // ── Export CSV ──
  const handleExportCSV = () => {
    const monthExpenses = expenses.filter(e => e.date.startsWith(exportMonth));
    const header = "Date,Merchant,Amount,Category,Card,Recurring,Notes,Status";
    const rows = monthExpenses.map(e =>
      `${e.date},"${e.merchant}",${e.amount},"${e.category}","****${e.cardLast4}",${e.recurring},"${e.notes || ""}","${e.status}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `expenses-${exportMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  // ── Card Management ──
  const handleAddCardManual = () => {
    if (!manualBrand || !manualLast4 || manualLast4.length !== 4) return;
    setCreditCards(prev => [...prev, {
      id: generateId(), brand: manualBrand, last4: manualLast4, color: manualColor,
      status: "connected", balance: 0, limit: 0, lastSync: null,
    }]);
    setShowConnectModal(false);
    setManualBrand(""); setManualLast4(""); setManualColor("#6366f1");
  };

  const deleteCard = (id) => {
    if (!window.confirm("Remove this card? Expenses linked to it will remain.")) return;
    setCreditCards(prev => prev.filter(c => c.id !== id));
  };

  const disconnectCard = (id) => {
    setCreditCards(prev => prev.map(c => c.id === id ? { ...c, status: "disconnected" } : c));
  };

  const reconnectCard = (id) => {
    setCreditCards(prev => prev.map(c => c.id === id ? { ...c, status: "connected", lastSync: new Date().toISOString() } : c));
  };

  // ── Plaid Integration ──
  const initPlaid = async () => {
    try {
      setPlaidStatus("loading");
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      if (!res.ok) throw new Error("Server error");
      const { link_token } = await res.json();
      if (!window.Plaid) {
        // Dynamically load Plaid Link script
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: async (publicToken, metadata) => {
          setPlaidStatus("syncing");
          const exRes = await fetch("/api/plaid/exchange-token", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_token: publicToken }),
          });
          const exData = await exRes.json();
          metadata.accounts.forEach(acct => {
            setCreditCards(prev => [...prev, {
              id: generateId(), brand: `${metadata.institution.name} — ${acct.name}`,
              last4: acct.mask, color: "#1a73e8", status: "connected", balance: 0, limit: 0,
              lastSync: new Date().toISOString(), plaidAccessToken: exData.access_token,
            }]);
          });
          // Fetch transactions
          const txRes = await fetch("/api/plaid/transactions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: exData.access_token }),
          });
          const txData = await txRes.json();
          if (txData.transactions) {
            const newExp = txData.transactions.map(tx => ({
              id: generateId(), date: tx.date,
              merchant: tx.name || tx.merchant_name || "Unknown",
              amount: Math.abs(tx.amount),
              category: expenseCategories.includes(tx.category?.[0]) ? tx.category[0] : "Unknown",
              cardLast4: metadata.accounts.find(a => a.account_id === tx.account_id)?.mask || "0000",
              recurring: false, receipt: null, notes: "", status: "needs_review",
            }));
            setExpenses(prev => [...newExp, ...prev]);
          }
          setPlaidStatus("done");
          setShowConnectModal(false);
        },
        onExit: () => setPlaidStatus(""),
      });
      handler.open();
    } catch (err) {
      console.error("Plaid error:", err);
      setPlaidStatus("error");
    }
  };

  // ── Budget ──
  const saveBudget = () => {
    if (!budgetCat || !budgetAmt) return;
    setBudgets(prev => ({ ...prev, [budgetCat]: parseFloat(budgetAmt) || 0 }));
    setBudgetCat(""); setBudgetAmt("");
  };

  const removeBudget = (cat) => {
    setBudgets(prev => { const n = { ...prev }; delete n[cat]; return n; });
  };

  const SUB_TABS = [
    { id: "feed", label: "Expense Feed", icon: "receipt" },
    { id: "cards", label: "Credit Cards", icon: "creditcard" },
    { id: "analysis", label: "Spending Analysis", icon: "piechart" },
    { id: "recurring", label: "Recurring", icon: "repeat" },
  ];

  const categoryColors = {
    "Software & Tools": "#6366f1", "Office Supplies": "#f59e0b", "Travel": "#3b82f6",
    "Marketing": "#ec4899", "Meals & Entertainment": "#10b981", "Subscriptions": "#8b5cf6",
    "Unknown": "#ef4444", "Insurance": "#06b6d4", "Professional Services": "#f97316",
    "Equipment": "#84cc16", "Rent & Utilities": "#14b8a6", "Payroll": "#a855f7",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Expenses</h1>
          <p style={{ color: "#888", fontSize: 14 }}>Track and categorize credit card expenses</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isSupabaseConfigured() && (
            <Btn variant={syncResult?.success ? "success" : "secondary"} icon="sync" onClick={handleSyncToCloud} disabled={syncing}>
              {syncing ? "Syncing..." : syncResult?.success ? "Synced!" : "Sync to Cloud"}
            </Btn>
          )}
          <Btn variant="secondary" icon="download" onClick={() => setShowExportModal(true)}>Export</Btn>
          <Btn variant="secondary" icon="sync" onClick={() => { setShowImportModal(true); setImportMode("choose"); }}>Import</Btn>
          <Btn variant="success" icon="plus" onClick={() => setShowAddModal(true)}>Add Expense</Btn>
          <Btn icon="creditcard" onClick={() => setShowConnectModal(true)}>Add Card</Btn>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="This Month" value={formatCurrency(monthTotal)} sub={`${thisMonth.length} transactions`} accent="#6366f1" icon="receipt" />
        <StatCard label="Recurring" value={formatCurrency(recurringTotal)} sub={`${recurringExpenses.length} subscriptions`} accent="#8b5cf6" icon="repeat" />
        <StatCard label="Needs Review" value={needsReview} sub="Uncategorized" accent="#ef4444" icon="alert" />
        <StatCard label="Daily Average" value={formatCurrency(dailyAvg)} sub="This month" accent="#10b981" icon="dollar" />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 0 }}>
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            style={{
              padding: "10px 16px", border: "none", borderBottom: subTab === tab.id ? "2px solid #6366f1" : "2px solid transparent",
              background: "transparent", color: subTab === tab.id ? "#6366f1" : "#888", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            }}>
            <Icon name={tab.icon} size={14} />{tab.label}
          </button>
        ))}
      </div>

      {/* ─── Expense Feed ─── */}
      {subTab === "feed" && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search expenses..."
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px 8px 34px", color: "#f0f0f0", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#666" }}><Icon name="search" size={14} /></span>
            </div>
            <Select label="" value={cardFilter} onChange={setCardFilter}
              options={[{ value: "all", label: "All Cards" }, { value: "manual", label: "Manual" }, ...creditCards.map(c => ({ value: c.last4, label: `${c.brand} (****${c.last4})` }))]}
              style={{ marginBottom: 0, minWidth: 140 }} />
            <Select label="" value={catFilter} onChange={setCatFilter}
              options={[{ value: "all", label: "All Categories" }, ...usedCategories.map(c => ({ value: c, label: c }))]}
              style={{ marginBottom: 0, minWidth: 160 }} />
            {selectedIds.size > 0 && (
              <>
                <Select label="" value="" onChange={bulkAssignCard}
                  options={[{ value: "", label: `Assign ${selectedIds.size} to Card...` }, { value: "manual", label: "Manual Entry" }, ...creditCards.map(c => ({ value: c.last4, label: `${c.brand} (****${c.last4})` }))]}
                  style={{ marginBottom: 0, minWidth: 180 }} />
                <Btn variant="danger" icon="trash" onClick={bulkDelete}>Delete {selectedIds.size}</Btn>
              </>
            )}
          </div>

          {/* Sort Controls */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#666" }}>Sort by:</span>
            {[
              { key: "date", label: "Date" },
              { key: "amount", label: "Amount" },
              { key: "merchant", label: "Merchant" },
              { key: "category", label: "Category" },
            ].map(s => (
              <button key={s.key} onClick={() => toggleSort(s.key)}
                style={{
                  padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 500,
                  background: sortBy === s.key ? "#6366f1" : "rgba(255,255,255,0.04)",
                  color: sortBy === s.key ? "#fff" : "#888",
                  cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4
                }}>
                {s.label}
                {sortBy === s.key && <span style={{ fontSize: 10 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
              </button>
            ))}
          </div>

          <Table
            columns={[
              { key: "select", label: "", headerRender: () => (
                <input type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  title={selectedIds.size === filtered.length ? "Deselect all" : "Select all"}
                  style={{ width: 15, height: 15, accentColor: "#6366f1", cursor: "pointer" }} />
              ), render: r => (
                <input type="checkbox" checked={selectedIds.has(r.id)} onChange={(e) => toggleSelect(r.id, e)}
                  style={{ width: 15, height: 15, accentColor: "#6366f1", cursor: "pointer" }} />
              )},
              { key: "date", label: "Date", render: r => formatDate(r.date) },
              { key: "merchant", label: "Merchant", render: r => (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{r.merchant}</span>
                  {r.recurring && r.recurring !== "none" && r.recurring !== "dismissed" && (
                    <Badge color={r.recurring === "yearly" ? "#3b82f6" : "#8b5cf6"} style={{ fontSize: 9 }}>
                      {r.recurring === "yearly" ? "Yearly" : "Monthly"}
                    </Badge>
                  )}
                </div>
              )},
              { key: "category", label: "Category", render: r => (
                <Badge color={categoryColors[r.category] || "#888"}>{r.category}</Badge>
              )},
              { key: "card", label: "Card", render: r => <span style={{ fontSize: 12, color: "#888", fontFamily: "'JetBrains Mono', monospace" }}>{r.cardLast4 === "manual" ? "Manual" : `****${r.cardLast4}`}</span> },
              { key: "receipt", label: "Receipt", align: "center", render: r => r.receipt ? <span style={{ color: "#10b981", fontSize: 16 }}>✓</span> : <span style={{ color: "#666" }}>–</span> },
              { key: "amount", label: "Amount", align: "right", render: r => (
                <span style={{ color: "#ef4444", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                  -{formatCurrency(r.amount)}
                </span>
              )},
              { key: "status", label: "Status", align: "center", render: r => (
                <Badge color={r.status === "needs_review" ? "#ef4444" : "#10b981"}>
                  {r.status === "needs_review" ? "Review" : "Done"}
                </Badge>
              )},
            ]}
            data={filtered}
            onRowClick={openExpenseDetail}
          />
          {filtered.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12, color: "#666" }}>
              <span>{selectedIds.size > 0 ? `${selectedIds.size} of ${filtered.length} selected` : `${filtered.length} expenses`}</span>
              <span>Total: <strong style={{ color: "#ef4444" }}>-{formatCurrency(filtered.reduce((s, e) => s + e.amount, 0))}</strong></span>
            </div>
          )}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
              {expenses.length === 0 ? "No expenses yet. Add one manually or import a CSV." : "No expenses match your filters."}
            </div>
          )}
        </div>
      )}

      {/* ─── Credit Cards ─── */}
      {subTab === "cards" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {creditCards.map(card => {
              const cardExpenses = expenses.filter(e => e.cardLast4 === card.last4);
              const cardTotal = cardExpenses.reduce((s, e) => s + e.amount, 0);
              return (
                <div key={card.id} style={{
                  background: `linear-gradient(135deg, ${card.color}, ${card.color}88)`, borderRadius: 16,
                  padding: 24, position: "relative", overflow: "hidden", minHeight: 180,
                }}>
                  <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                  <div style={{ position: "absolute", bottom: -30, left: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                  <div style={{ position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", maxWidth: "70%" }}>{card.brand}</div>
                      <Badge color={card.status === "connected" ? "#10b981" : "#ef4444"} style={{ background: "rgba(255,255,255,0.15)" }}>
                        {card.status === "connected" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div style={{ fontSize: 20, fontFamily: "'JetBrains Mono', monospace", color: "#fff", letterSpacing: 3, marginBottom: 12 }}>
                      •••• •••• •••• {card.last4}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
                      {cardExpenses.length} expense{cardExpenses.length !== 1 ? "s" : ""} · Total: {formatCurrency(cardTotal)}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {card.plaidAccessToken && card.status === "connected" && (
                        <Btn variant="ghost" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 11, padding: "4px 10px" }} icon="sync">Sync</Btn>
                      )}
                      {card.status === "connected" ? (
                        <Btn variant="ghost" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 11, padding: "4px 10px" }} onClick={() => disconnectCard(card.id)}>Deactivate</Btn>
                      ) : (
                        <Btn variant="ghost" style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 11, padding: "4px 10px" }} onClick={() => reconnectCard(card.id)}>Reactivate</Btn>
                      )}
                      <Btn variant="ghost" style={{ background: "rgba(239,68,68,0.3)", color: "#fff", fontSize: 11, padding: "4px 10px" }} onClick={() => deleteCard(card.id)}>Remove</Btn>
                    </div>
                    {card.lastSync && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>Last synced: {new Date(card.lastSync).toLocaleString()}</div>}
                  </div>
                </div>
              );
            })}

            {/* Add Card Tile */}
            <div onClick={() => setShowConnectModal(true)} style={{
              background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: 24, minHeight: 180,
              border: "2px dashed rgba(255,255,255,0.1)", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon name="plus" size={24} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#888" }}>Add a Card</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Manually or via Plaid</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Spending Analysis ─── */}
      {subTab === "analysis" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Category Breakdown with Budget */}
          <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>Spending by Category</h3>
              <Btn variant="secondary" icon="edit" onClick={() => setShowBudgetModal(true)} style={{ fontSize: 11, padding: "4px 10px" }}>Budgets</Btn>
            </div>
            {categoryTotals.map(ct => {
              const budget = budgets[ct.category];
              const overBudget = budget && ct.total > budget;
              return (
                <div key={ct.category} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: overBudget ? "#ef4444" : "#ccc" }}>
                      {ct.category} {overBudget && "⚠"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatCurrency(ct.total)}{budget ? ` / ${formatCurrency(budget)}` : ""}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${budget ? Math.min((ct.total / budget) * 100, 100) : (ct.total / maxCategoryTotal) * 100}%`, background: overBudget ? "#ef4444" : (categoryColors[ct.category] || "#6366f1"), borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                  <div style={{ fontSize: 11, color: overBudget ? "#ef4444" : "#666", marginTop: 2 }}>
                    {ct.count} transaction{ct.count > 1 ? "s" : ""}
                    {overBudget && ` · ${formatCurrency(ct.total - budget)} over budget`}
                    {budget && !overBudget && ` · ${formatCurrency(budget - ct.total)} remaining`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Merchants */}
          <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 20 }}>Top Merchants</h3>
            {topMerchants.map((m, i) => (
              <div key={m.merchant} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#6366f1" }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#f0f0f0", fontWeight: 500 }}>{m.merchant}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{m.count} transaction{m.count > 1 ? "s" : ""}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(m.total)}</div>
              </div>
            ))}
          </div>

          {/* Spending by Card */}
          <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 20 }}>Spending by Card</h3>
            {cardTotals.map(ct => (
              <div key={ct.last4} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ width: 40, height: 28, borderRadius: 6, background: ct.card?.color || "#666", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="creditcard" size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#f0f0f0", fontWeight: 500 }}>****{ct.last4}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{ct.card?.brand || "Unknown Card"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(ct.total)}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{ct.count} txns</div>
                </div>
              </div>
            ))}
          </div>

          {/* Monthly Trend */}
          <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 20 }}>Monthly Spending Trend</h3>
            {(() => {
              const weeks = [
                { label: "Week 1 (Feb 1-7)", total: expenses.filter(e => { const d = parseInt(e.date.split("-")[2]); return d >= 1 && d <= 7; }).reduce((s, e) => s + e.amount, 0) },
                { label: "Week 2 (Feb 8-14)", total: expenses.filter(e => { const d = parseInt(e.date.split("-")[2]); return d >= 8 && d <= 14; }).reduce((s, e) => s + e.amount, 0) },
                { label: "Week 3 (Feb 15-21)", total: expenses.filter(e => { const d = parseInt(e.date.split("-")[2]); return d >= 15 && d <= 21; }).reduce((s, e) => s + e.amount, 0) },
                { label: "Week 4 (Feb 22-28)", total: expenses.filter(e => { const d = parseInt(e.date.split("-")[2]); return d >= 22 && d <= 28; }).reduce((s, e) => s + e.amount, 0) },
              ];
              const maxWeek = Math.max(...weeks.map(w => w.total), 1);
              return weeks.map(w => (
                <div key={w.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#888" }}>{w.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#f0f0f0", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(w.total)}</span>
                  </div>
                  <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(w.total / maxWeek) * 100}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 4 }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* ─── Recurring ─── */}
      {subTab === "recurring" && (() => {
        const monthly = expenses.filter(e => e.recurring === "monthly" || e.recurring === true);
        const yearly = expenses.filter(e => e.recurring === "yearly");
        const monthlyTotal = monthly.reduce((s, e) => s + e.amount, 0) + yearly.reduce((s, e) => s + e.amount / 12, 0);
        const annualProjection = monthly.reduce((s, e) => s + e.amount * 12, 0) + yearly.reduce((s, e) => s + e.amount, 0);
        const allRecur = [...monthly, ...yearly];
        const pendingDetected = detectRecurring.filter(d => d.items.every(e => !e.recurring || e.recurring === "none" || e.recurring === false));

        return (
          <div>
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              <div style={{ flex: 1, background: "#1a1d23", borderRadius: 14, padding: "20px 24px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Monthly Cost</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(monthlyTotal)}</div>
              </div>
              <div style={{ flex: 1, background: "#1a1d23", borderRadius: 14, padding: "20px 24px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Annual Projection</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(annualProjection)}</div>
              </div>
              <div style={{ flex: 1, background: "#1a1d23", borderRadius: 14, padding: "20px 24px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Active Subscriptions</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#8b5cf6", fontFamily: "'JetBrains Mono', monospace" }}>{allRecur.length}</div>
              </div>
            </div>

            {/* Detected Recurring - needs confirmation */}
            {pendingDetected.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, color: "#f59e0b", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="alert" size={16} /> Detected Recurring ({pendingDetected.length})
                </h3>
                <p style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>These expenses appear to be recurring based on similar amounts and frequency. Confirm to track them.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                  {pendingDetected.map((d, i) => (
                    <div key={i} style={{ background: "rgba(245,158,11,0.06)", borderRadius: 12, padding: 16, border: "1px solid rgba(245,158,11,0.15)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0" }}>{d.merchant}</div>
                          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                            {d.count} occurrences · ~{d.avgDays} days apart · Last: {formatDate(d.lastDate)}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", fontFamily: "'JetBrains Mono', monospace" }}>
                            {formatCurrency(d.avgAmount)}
                          </div>
                          <Badge color={d.frequency === "monthly" ? "#8b5cf6" : d.frequency === "yearly" ? "#3b82f6" : "#10b981"} style={{ fontSize: 9, marginTop: 4 }}>
                            {d.frequency}
                          </Badge>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <Btn size="sm" onClick={() => confirmRecurring(d, d.frequency)}>
                          Confirm as {d.frequency}
                        </Btn>
                        {d.frequency !== "monthly" && (
                          <Btn size="sm" variant="secondary" onClick={() => confirmRecurring(d, "monthly")}>Monthly</Btn>
                        )}
                        {d.frequency !== "yearly" && (
                          <Btn size="sm" variant="secondary" onClick={() => confirmRecurring(d, "yearly")}>Yearly</Btn>
                        )}
                        <Btn size="sm" variant="ghost" onClick={() => dismissRecurring(d)}>Dismiss</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmed Recurring */}
            {allRecur.length > 0 && (
              <>
                <h3 style={{ fontSize: 14, color: "#8b5cf6", marginBottom: 12 }}>Confirmed Subscriptions ({allRecur.length})</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {allRecur.map(exp => (
                    <div key={exp.id} style={{ background: "#1a1d23", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>{exp.merchant}</div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{exp.notes || exp.category}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0", fontFamily: "'JetBrains Mono', monospace" }}>
                            {formatCurrency(exp.amount)}
                          </div>
                          <Badge color={exp.recurring === "yearly" ? "#3b82f6" : "#8b5cf6"} style={{ fontSize: 9, marginTop: 4 }}>
                            {exp.recurring === "yearly" ? "yearly" : "monthly"}
                          </Badge>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Badge color={categoryColors[exp.category] || "#888"}>{exp.category}</Badge>
                        <span style={{ fontSize: 11, color: "#666", fontFamily: "'JetBrains Mono', monospace" }}>****{exp.cardLast4}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
                        {exp.recurring === "yearly" ? `Monthly: ${formatCurrency(exp.amount / 12)}` : `Annual: ${formatCurrency(exp.amount * 12)}`}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {allRecur.length === 0 && pendingDetected.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
                No recurring expenses detected yet. Add more expenses to see patterns.
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── Expense Detail Modal ─── */}
      <Modal isOpen={editingExpense !== null} onClose={() => setEditingExpense(null)} title="Expense Detail" width="520px">
        {editingExpense && (
          <div>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0" }}>{editingExpense.merchant}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}>-{formatCurrency(editingExpense.amount)}</span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#888" }}>
                <span>{formatDate(editingExpense.date)}</span>
                <span>{editingExpense.cardLast4 === "manual" ? "Manual Entry" : `****${editingExpense.cardLast4}`}</span>
                {editingExpense.recurring && editingExpense.recurring !== "none" && editingExpense.recurring !== "dismissed" && (
                  <Badge color={editingExpense.recurring === "yearly" ? "#3b82f6" : "#8b5cf6"} style={{ fontSize: 9 }}>
                    {editingExpense.recurring === "yearly" ? "Yearly" : "Monthly"}
                  </Badge>
                )}
              </div>
            </div>

            <Select label="Category" value={editCategory} onChange={v => {
                if (v === "__add_custom__") { handleCustomCategory(editCategory, (c) => { setEditCategory(c); if (applyToAll && c !== "Unknown") applyRuleNow(c); }); return; }
                setEditCategory(v); if (applyToAll && v !== "Unknown") applyRuleNow(v);
              }}
              options={[...expenseCategories.map(c => ({ value: c, label: c })), { value: "__add_custom__", label: "+ Add Custom Category" }]} />

            {editCategory !== "Unknown" && (() => {
              const merchantKey = editingExpense.merchant.toLowerCase().trim();
              const othersCount = expenses.filter(e => e.id !== editingExpense.id && e.merchant.toLowerCase().trim() === merchantKey).length;
              return (
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 14, marginTop: -6, borderRadius: 8,
                  background: applyToAll ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${applyToAll ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.06)"}`,
                  cursor: "pointer", transition: "all 0.15s" }}>
                  <input type="checkbox" checked={applyToAll} onChange={e => { setApplyToAll(e.target.checked); if (e.target.checked) applyRuleNow(editCategory); }} style={{ accentColor: "#6366f1", cursor: "pointer" }} />
                  <span style={{ fontSize: 12, color: applyToAll ? "#c7d2fe" : "#888" }}>
                    {othersCount > 0
                      ? <>Apply <strong style={{ color: applyToAll ? "#a5b4fc" : "#ccc" }}>"{editCategory}"</strong> to all {othersCount} other <strong style={{ color: applyToAll ? "#a5b4fc" : "#ccc" }}>{editingExpense.merchant}</strong> expense{othersCount > 1 ? "s" : ""} + remember for future imports</>
                      : <>Always categorize <strong style={{ color: applyToAll ? "#a5b4fc" : "#ccc" }}>{editingExpense.merchant}</strong> as <strong style={{ color: applyToAll ? "#a5b4fc" : "#ccc" }}>"{editCategory}"</strong> for future imports</>
                    }
                  </span>
                </label>
              );
            })()}

            <Select label="Recurring" value={editRecurring} onChange={setEditRecurring}
              options={[
                { value: "none", label: "Not Recurring" },
                { value: "monthly", label: "Monthly Subscription" },
                { value: "yearly", label: "Yearly Subscription" },
              ]} />

            <TextArea label="Notes" value={editNotes} onChange={setEditNotes} rows={3} placeholder="Add notes about this expense..." />

            {/* Receipt Upload */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Receipt</label>
              {editReceipt ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img src={editReceipt} alt="Receipt" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }} />
                  <button onClick={() => setEditReceipt(null)}
                    style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ) : (
                <div>
                  <input ref={receiptInputRef} type="file" accept="image/*,.pdf" onChange={handleReceiptUpload} style={{ display: "none" }} />
                  <Btn variant="secondary" icon="plus" onClick={() => receiptInputRef.current?.click()}>Upload Receipt</Btn>
                  <span style={{ fontSize: 11, color: "#666", marginLeft: 8 }}>JPG, PNG, or PDF (max 5MB)</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Btn variant="danger" icon="trash" onClick={() => deleteExpense(editingExpense.id)}>Delete</Btn>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="secondary" onClick={() => setEditingExpense(null)}>Cancel</Btn>
                <Btn onClick={saveExpenseDetail}>Save Changes</Btn>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Add Card Modal ─── */}
      <Modal isOpen={showConnectModal} onClose={() => { setShowConnectModal(false); setPlaidStatus(""); }} title="Add Credit Card" width="480px">
        <div>
          {/* Manual Entry */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", marginBottom: 12 }}>Manual Entry</h4>
            <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>Add a card to tag expenses against. You can import transactions via CSV.</p>
            <Input label="Card Name" value={manualBrand} onChange={setManualBrand} placeholder="e.g. Chase Sapphire, Amex Gold" />
            <div style={{ display: "flex", gap: 12 }}>
              <Input label="Last 4 Digits" value={manualLast4} onChange={v => setManualLast4(v.replace(/\D/g, "").slice(0, 4))} placeholder="1234" style={{ flex: 1 }} />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Color</label>
                <input type="color" value={manualColor} onChange={e => setManualColor(e.target.value)}
                  style={{ width: 44, height: 38, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, background: "transparent", cursor: "pointer" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn onClick={handleAddCardManual} disabled={!manualBrand || manualLast4.length !== 4}>Add Card</Btn>
            </div>
          </div>

          {/* Plaid Integration */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", marginBottom: 8 }}>Auto-Sync via Plaid</h4>
            <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
              Connect directly to your bank to automatically import transactions.
              {!plaidAvailable && " Requires a Plaid backend server — see server/plaid.js for setup."}
            </p>
            {plaidAvailable ? (
              <div>
                <Btn icon="sync" onClick={initPlaid} disabled={plaidStatus === "loading" || plaidStatus === "syncing"}>
                  {plaidStatus === "loading" ? "Opening Plaid..." : plaidStatus === "syncing" ? "Syncing..." : plaidStatus === "done" ? "Connected!" : "Connect via Plaid"}
                </Btn>
                {plaidStatus === "error" && <span style={{ color: "#ef4444", fontSize: 12, marginLeft: 8 }}>Connection failed. Try again.</span>}
              </div>
            ) : (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 12, fontSize: 12, color: "#666" }}>
                <strong style={{ color: "#888" }}>Setup required:</strong> Run <code style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>node server/plaid.js</code> with your Plaid API keys. See the file for instructions.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ─── Export Modal ─── */}
      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Export Expenses" width="400px">
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>Download expenses as CSV for the selected month:</p>
        <Input label="Month" type="month" value={exportMonth} onChange={setExportMonth} />
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#888" }}>
            {expenses.filter(e => e.date.startsWith(exportMonth)).length} expenses found for {exportMonth}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={() => setShowExportModal(false)}>Cancel</Btn>
          <Btn icon="download" onClick={handleExportCSV}>Download CSV</Btn>
        </div>
      </Modal>

      {/* ─── Add Expense Modal ─── */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Expense" width="480px">
        <Input label="Date" type="date" value={newDate} onChange={setNewDate} />
        <Input label="Merchant / Description" value={newMerchant} onChange={setNewMerchant} placeholder="e.g. Office Depot, Adobe, Delta Airlines" />
        <Input label="Amount ($)" type="number" value={newAmount} onChange={setNewAmount} placeholder="0.00" min="0" step="0.01" />
        <Select label="Category" value={newCategory} onChange={v => {
            if (v === "__add_custom__") { handleCustomCategory(newCategory, setNewCategory); return; }
            setNewCategory(v);
          }}
          options={[...expenseCategories.map(c => ({ value: c, label: c })), { value: "__add_custom__", label: "+ Add Custom Category" }]} />
        <Select label="Card" value={newCard} onChange={setNewCard}
          options={[{ value: "", label: "Manual (no card)" }, ...creditCards.map(c => ({ value: c.last4, label: `${c.brand} (****${c.last4})` }))]} />
        <Select label="Recurring" value={newRecurring ? (newRecurring === true ? "monthly" : newRecurring) : "none"}
          onChange={v => setNewRecurring(v === "none" ? false : v)}
          options={[
            { value: "none", label: "Not Recurring" },
            { value: "monthly", label: "Monthly Subscription" },
            { value: "yearly", label: "Yearly Subscription" },
          ]} />
        <TextArea label="Notes (optional)" value={newNotes} onChange={setNewNotes} rows={2} placeholder="Any additional details..." />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Btn variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Btn>
          <Btn onClick={handleAddExpense} disabled={!newMerchant || !newAmount}>Add Expense</Btn>
        </div>
      </Modal>

      {/* ─── Import Modal (CSV + PDF) ─── */}
      <Modal isOpen={showImportModal} onClose={() => { setShowImportModal(false); setImportMode("choose"); setCsvData([]); setCsvColumns([]); setPdfParsed([]); setPdfError(""); }}
        title={importMode === "choose" ? "Import Expenses" : importMode === "csv" ? "Import from CSV" : "Import from PDF Statement"} width="700px">

        {/* ── Choose Format ── */}
        {importMode === "choose" && (
          <div>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Choose how to import your expenses:</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* CSV Option */}
              <div onClick={() => setImportMode("csv")}
                style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"; e.currentTarget.style.background = "rgba(99,102,241,0.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Icon name="invoice" size={24} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 4 }}>CSV File</div>
                <div style={{ fontSize: 12, color: "#888" }}>Upload a .csv export from your bank. You'll map columns to fields.</div>
              </div>

              {/* PDF Option */}
              <div onClick={() => document.getElementById("pdf-upload-input")?.click()}
                style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", textAlign: "center", transition: "all 0.15s", position: "relative" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"; e.currentTarget.style.background = "rgba(16,185,129,0.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Icon name="receipt" size={24} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 4 }}>PDF Statements</div>
                <div style={{ fontSize: 12, color: "#888" }}>Upload one or more bank/credit card statement PDFs. Transactions are auto-detected.</div>
                {pdfParsing && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                    <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.2)", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                    <span style={{ color: "#10b981", fontSize: 12 }}>Reading PDFs...</span>
                  </div>
                )}
              </div>
            </div>
            <input id="pdf-upload-input" type="file" accept=".pdf" multiple onChange={handlePdfFile} style={{ display: "none" }} />
            {pdfError && (
              <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: 12, marginTop: 16, fontSize: 12, color: "#ef4444", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <Icon name="alert" size={16} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Could not parse PDF</div>
                  {pdfError.split("\n").map((line, i) => <div key={i}>{line}</div>)}
                </div>
              </div>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── CSV Flow ── */}
        {importMode === "csv" && csvData.length === 0 && (
          <div>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
              Upload a CSV file exported from your bank or credit card provider.
            </p>
            <div style={{ border: "2px dashed rgba(255,255,255,0.1)", borderRadius: 12, padding: 40, textAlign: "center", cursor: "pointer" }}
              onClick={() => document.getElementById("csv-upload-input")?.click()}>
              <Icon name="download" size={32} />
              <div style={{ fontSize: 14, color: "#888", marginTop: 12 }}>Click to upload CSV file</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Supports Chase, Amex, Capital One, and generic CSV formats</div>
            </div>
            <input id="csv-upload-input" type="file" accept=".csv" onChange={handleCSVFile} style={{ display: "none" }} />
            <div style={{ marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => setImportMode("choose")}>Back</Btn>
            </div>
          </div>
        )}

        {importMode === "csv" && csvData.length > 0 && (
          <div>
            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: "#10b981" }}>
              Found {csvData.length} rows with {csvColumns.length} columns
            </div>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", marginBottom: 12 }}>Map Columns</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              <Select label="Date Column *" value={csvMapping.date} onChange={v => setCsvMapping(p => ({ ...p, date: v }))}
                options={[{ value: "", label: "-- Select --" }, ...csvColumns.map((c, i) => ({ value: String(i), label: c }))]} />
              <Select label="Merchant Column *" value={csvMapping.merchant} onChange={v => setCsvMapping(p => ({ ...p, merchant: v }))}
                options={[{ value: "", label: "-- Select --" }, ...csvColumns.map((c, i) => ({ value: String(i), label: c }))]} />
              <Select label="Amount Column *" value={csvMapping.amount} onChange={v => setCsvMapping(p => ({ ...p, amount: v }))}
                options={[{ value: "", label: "-- Select --" }, ...csvColumns.map((c, i) => ({ value: String(i), label: c }))]} />
              <Select label="Category Column (optional)" value={csvMapping.category} onChange={v => setCsvMapping(p => ({ ...p, category: v }))}
                options={[{ value: "", label: "None / Unknown" }, ...csvColumns.map((c, i) => ({ value: String(i), label: c }))]} />
            </div>
            <Select label="Assign to Card" value={csvCard} onChange={setCsvCard}
              options={[{ value: "", label: "None / Manual" }, ...creditCards.map(c => ({ value: c.last4, label: `${c.brand} (****${c.last4})` }))]} />
            {/* Smart Categorization Preview */}
            {csvPreview.length > 0 && (
              <div style={{ marginTop: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>Smart Categorization Preview</h4>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    <span style={{ color: "#10b981" }}>{csvPreview.filter(r => r.category !== "Unknown").length}</span> auto-categorized,
                    <span style={{ color: "#f59e0b", marginLeft: 4 }}>{csvPreview.filter(r => r.category === "Unknown").length}</span> need review
                  </div>
                </div>
                <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", maxHeight: 280, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.03)", position: "sticky", top: 0 }}>
                        <th style={{ padding: "8px 10px", color: "#888", textAlign: "left", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Date</th>
                        <th style={{ padding: "8px 10px", color: "#888", textAlign: "left", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Merchant</th>
                        <th style={{ padding: "8px 10px", color: "#888", textAlign: "right", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Amount</th>
                        <th style={{ padding: "8px 10px", color: "#888", textAlign: "left", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Category</th>
                        <th style={{ padding: "8px 10px", color: "#888", textAlign: "center", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 20).map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          <td style={{ padding: "6px 10px", color: "#ccc" }}>{row.date}</td>
                          <td style={{ padding: "6px 10px", color: "#f0f0f0", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.merchant}</td>
                          <td style={{ padding: "6px 10px", color: "#ef4444", textAlign: "right", fontFamily: "monospace" }}>${row.amount.toFixed(2)}</td>
                          <td style={{ padding: "6px 10px" }}>
                            <Badge color={row.category === "Unknown" ? "#ef4444" : row.confidence === "high" ? "#10b981" : row.confidence === "medium" ? "#3b82f6" : "#f59e0b"}>
                              {row.category}
                            </Badge>
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "center" }}>
                            {row.source === "learned" && <span title="From your saved rules" style={{ cursor: "help", fontSize: 10, color: "#10b981" }}>Learned</span>}
                            {row.source === "pattern" && <span title="Matched common merchant pattern" style={{ cursor: "help", fontSize: 10, color: "#3b82f6" }}>Pattern</span>}
                            {row.source === "fuzzy" && <span title="Fuzzy match to saved rule" style={{ cursor: "help", fontSize: 10, color: "#f59e0b" }}>Fuzzy</span>}
                            {row.source === "csv" && <span title="From CSV file" style={{ cursor: "help", fontSize: 10, color: "#8b5cf6" }}>CSV</span>}
                            {!row.source && <span style={{ fontSize: 10, color: "#666" }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvPreview.length > 20 && <div style={{ fontSize: 11, color: "#888", marginTop: 8, textAlign: "center" }}>Showing 20 of {csvPreview.length} rows</div>}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Btn variant="secondary" onClick={() => { setCsvData([]); setCsvColumns([]); }}>Choose Different File</Btn>
              <Btn onClick={handleImportCSV} disabled={!csvMapping.date || !csvMapping.merchant || !csvMapping.amount}>
                Import {csvData.length} Expenses
              </Btn>
            </div>
          </div>
        )}

        {/* ── PDF Results ── */}
        {importMode === "pdf" && pdfParsed.length > 0 && (
          <div>
            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: "#10b981" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: pdfFileNames.length > 1 ? 8 : 0 }}>
                <span>Parsed {pdfParsed.length} transactions from <strong>{pdfFileNames.length} file{pdfFileNames.length > 1 ? "s" : ""}</strong></span>
                <span>{pdfParsed.filter(t => t.isCredit).length} credits/payments auto-excluded</span>
              </div>
              {pdfFileNames.length > 1 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {pdfFileNames.map((name, i) => {
                    const count = pdfParsed.filter(t => t.source === name).length;
                    return <span key={i} style={{ background: "rgba(16,185,129,0.12)", borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>{name} ({count})</span>;
                  })}
                </div>
              )}
            </div>
            <input id="pdf-add-more-input" type="file" accept=".pdf" multiple onChange={e => handlePdfFile(e, true)} style={{ display: "none" }} />

            <Select label="Assign to Card" value={pdfCard} onChange={setPdfCard}
              options={[{ value: "", label: "None / Manual" }, ...creditCards.map(c => ({ value: c.last4, label: `${c.brand} (****${c.last4})` }))]} />

            <h4 style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", marginBottom: 8, marginTop: 12 }}>Detected Transactions</h4>
            <p style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>Uncheck any rows you don't want to import. Credits/payments are excluded by default.</p>

            <div style={{ overflowX: "auto", maxHeight: 350, overflowY: "auto", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", position: "sticky", top: 0, zIndex: 1 }}>
                    <th style={{ padding: "8px 10px", color: "#888", textAlign: "center", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)", width: 30, background: "rgba(30,30,46,0.95)" }}>
                      <input type="checkbox"
                        checked={pdfParsed.filter(t => !t.isCredit).every(t => !pdfExcluded.has(t.id))}
                        onChange={() => {
                          const charges = pdfParsed.filter(t => !t.isCredit);
                          const allIncluded = charges.every(t => !pdfExcluded.has(t.id));
                          setPdfExcluded(allIncluded ? new Set(charges.map(t => t.id)) : new Set());
                        }}
                        style={{ accentColor: "#6366f1" }} />
                    </th>
                    <th style={{ padding: "8px 10px", color: "#888", textAlign: "left", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(30,30,46,0.95)" }}>Date</th>
                    <th style={{ padding: "8px 10px", color: "#888", textAlign: "left", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(30,30,46,0.95)" }}>Description</th>
                    <th style={{ padding: "8px 10px", color: "#888", textAlign: "right", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(30,30,46,0.95)" }}>Amount</th>
                    <th style={{ padding: "8px 10px", color: "#888", textAlign: "left", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(30,30,46,0.95)" }}>Category</th>
                    {pdfFileNames.length > 1 && <th style={{ padding: "8px 10px", color: "#888", textAlign: "left", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(30,30,46,0.95)" }}>Source</th>}
                  </tr>
                </thead>
                <tbody>
                  {pdfParsed.map(t => {
                    const excluded = pdfExcluded.has(t.id) || t.isCredit;
                    const smart = t.isCredit ? null : smartCategorize(t.merchant, categoryRules);
                    return (
                      <tr key={t.id}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", opacity: excluded ? 0.4 : 1 }}
                        onClick={() => !t.isCredit && togglePdfRow(t.id)}>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          {t.isCredit ? (
                            <span style={{ color: "#666", fontSize: 10 }}>skip</span>
                          ) : (
                            <input type="checkbox" checked={!pdfExcluded.has(t.id)}
                              onChange={() => togglePdfRow(t.id)} onClick={e => e.stopPropagation()}
                              style={{ accentColor: "#6366f1", cursor: "pointer" }} />
                          )}
                        </td>
                        <td style={{ padding: "6px 10px", color: "#ccc", whiteSpace: "nowrap" }}>{formatDate(t.date)}</td>
                        <td style={{ padding: "6px 10px", color: excluded ? "#666" : "#f0f0f0", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.merchant}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: t.isCredit ? "#10b981" : "#ef4444" }}>
                          {t.isCredit ? "+" : "-"}{formatCurrency(t.amount)}
                        </td>
                        <td style={{ padding: "6px 10px" }}>
                          {t.isCredit ? (
                            <Badge color="#10b981" style={{ fontSize: 9 }}>Credit</Badge>
                          ) : (
                            <Badge color={smart?.category === "Unknown" ? "#ef4444" : smart?.confidence === "high" ? "#10b981" : smart?.confidence === "medium" ? "#3b82f6" : "#f59e0b"} style={{ fontSize: 9 }}>
                              {smart?.category || "Unknown"}
                            </Badge>
                          )}
                        </td>
                        {pdfFileNames.length > 1 && <td style={{ padding: "6px 10px", color: "#888", fontSize: 11, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.source}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#888" }}>
                  {pdfParsed.filter(t => !t.isCredit && !pdfExcluded.has(t.id)).length} charges selected
                </span>
                <span style={{ color: "#ef4444", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                  Total: -{formatCurrency(pdfParsed.filter(t => !t.isCredit && !pdfExcluded.has(t.id)).reduce((s, t) => s + t.amount, 0))}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>
                <span style={{ color: "#10b981" }}>
                  {pdfParsed.filter(t => !t.isCredit && !pdfExcluded.has(t.id) && smartCategorize(t.merchant, categoryRules).category !== "Unknown").length}
                </span> auto-categorized,{" "}
                <span style={{ color: "#f59e0b" }}>
                  {pdfParsed.filter(t => !t.isCredit && !pdfExcluded.has(t.id) && smartCategorize(t.merchant, categoryRules).category === "Unknown").length}
                </span> need review
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="secondary" onClick={() => { setImportMode("choose"); setPdfParsed([]); setPdfError(""); setPdfFileNames([]); }}>Back</Btn>
                <Btn variant="ghost" icon="download" onClick={() => document.getElementById("pdf-add-more-input")?.click()}>Add More PDFs</Btn>
              </div>
              <Btn onClick={handleImportPdf} disabled={pdfParsed.filter(t => !t.isCredit && !pdfExcluded.has(t.id)).length === 0}>
                Import {pdfParsed.filter(t => !t.isCredit && !pdfExcluded.has(t.id)).length} Expenses
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Budget Manager Modal ─── */}
      <Modal isOpen={showBudgetModal} onClose={() => setShowBudgetModal(false)} title="Category Budgets" width="480px">
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>Set monthly spending limits per category. You'll see warnings when you approach or exceed them.</p>

        {/* Existing budgets */}
        {Object.keys(budgets).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {Object.entries(budgets).map(([cat, limit]) => {
              const spent = expenses.filter(e => e.category === cat && e.date.startsWith(currentMonth)).reduce((s, e) => s + e.amount, 0);
              const pct = limit > 0 ? (spent / limit) * 100 : 0;
              return (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#f0f0f0", fontWeight: 500 }}>{cat}</div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pct > 100 ? "#ef4444" : pct > 80 ? "#f59e0b" : "#10b981", borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{formatCurrency(spent)} / {formatCurrency(limit)} ({Math.round(pct)}%)</div>
                  </div>
                  <button onClick={() => removeBudget(cat)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: 4 }}>
                    <Icon name="x" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new budget */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <Select label="Category" value={budgetCat} onChange={setBudgetCat}
            options={[{ value: "", label: "Select category..." }, ...expenseCategories.filter(c => c !== "Unknown" && !budgets[c]).map(c => ({ value: c, label: c }))]}
            style={{ flex: 2 }} />
          <Input label="Monthly Limit ($)" type="number" value={budgetAmt} onChange={setBudgetAmt} placeholder="500" style={{ flex: 1 }} />
          <Btn onClick={saveBudget} disabled={!budgetCat || !budgetAmt} style={{ marginBottom: 14 }}>Add</Btn>
        </div>
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: INVOICING
// ═══════════════════════════════════════════════════════

const Invoicing = ({ invoices, setInvoices }) => {
  const [showNew, setShowNew] = useState(false);
  const [selectedInv, setSelectedInv] = useState(null);
  const [newInvoice, setNewInvoice] = useState({ client: "", email: "", items: [{ desc: "", qty: 1, rate: 0 }], dueDate: "" });

  const nextNum = `INV-${String(invoices.length + 1).padStart(3, "0")}`;

  const createInvoice = () => {
    const inv = {
      id: generateId(),
      number: nextNum,
      client: newInvoice.client,
      email: newInvoice.email,
      items: newInvoice.items,
      status: "draft",
      date: new Date().toISOString().split("T")[0],
      dueDate: newInvoice.dueDate,
      paidDate: null,
    };
    setInvoices(prev => [...prev, inv]);
    setNewInvoice({ client: "", email: "", items: [{ desc: "", qty: 1, rate: 0 }], dueDate: "" });
    setShowNew(false);
  };

  const totalRevenue = invoices.reduce((s, inv) => s + inv.items.reduce((a, it) => a + it.qty * it.rate, 0), 0);
  const paidTotal = invoices.filter(i => i.status === "paid").reduce((s, inv) => s + inv.items.reduce((a, it) => a + it.qty * it.rate, 0), 0);
  const outstandingTotal = invoices.filter(i => i.status === "sent").reduce((s, inv) => s + inv.items.reduce((a, it) => a + it.qty * it.rate, 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Invoicing</h1>
          <p style={{ color: "#888", fontSize: 14 }}>Create, track, and manage client invoices</p>
        </div>
        <Btn icon="plus" onClick={() => setShowNew(true)}>New Invoice</Btn>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Invoiced" value={formatCurrency(totalRevenue)} accent="#6366f1" icon="invoice" />
        <StatCard label="Paid" value={formatCurrency(paidTotal)} accent="#10b981" icon="check" />
        <StatCard label="Outstanding" value={formatCurrency(outstandingTotal)} accent="#f59e0b" icon="alert" />
      </div>

      <Table
        columns={[
          { key: "number", label: "Invoice #", render: r => <span style={{ fontFamily: "monospace", color: "#6366f1", fontWeight: 600 }}>{r.number}</span> },
          { key: "client", label: "Client" },
          { key: "date", label: "Date", render: r => formatDate(r.date) },
          { key: "dueDate", label: "Due Date", render: r => formatDate(r.dueDate) },
          { key: "total", label: "Total", align: "right", render: r => (
            <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{formatCurrency(r.items.reduce((a, it) => a + it.qty * it.rate, 0))}</span>
          )},
          { key: "status", label: "Status", render: r => (
            <Badge color={r.status === "paid" ? "#10b981" : r.status === "sent" ? "#f59e0b" : "#888"}>{r.status}</Badge>
          )},
        ]}
        data={invoices}
        onRowClick={r => setSelectedInv(r)}
      />

      {/* New Invoice Modal */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title={`New Invoice — ${nextNum}`} width="650px">
        <Input label="Client Name" value={newInvoice.client} onChange={v => setNewInvoice(p => ({ ...p, client: v }))} placeholder="Acme Corp" />
        <Input label="Client Email" value={newInvoice.email} onChange={v => setNewInvoice(p => ({ ...p, email: v }))} placeholder="billing@acme.com" />
        <Input label="Due Date" type="date" value={newInvoice.dueDate} onChange={v => setNewInvoice(p => ({ ...p, dueDate: v }))} />

        <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, marginTop: 8 }}>Line Items</div>
        {newInvoice.items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={item.desc} onChange={e => { const items = [...newInvoice.items]; items[i].desc = e.target.value; setNewInvoice(p => ({ ...p, items })); }}
              placeholder="Description" style={{ flex: 3, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
            <input type="number" value={item.qty} onChange={e => { const items = [...newInvoice.items]; items[i].qty = Number(e.target.value); setNewInvoice(p => ({ ...p, items })); }}
              placeholder="Qty" style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
            <input type="number" value={item.rate} onChange={e => { const items = [...newInvoice.items]; items[i].rate = Number(e.target.value); setNewInvoice(p => ({ ...p, items })); }}
              placeholder="Rate" style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
          </div>
        ))}
        <Btn variant="ghost" icon="plus" onClick={() => setNewInvoice(p => ({ ...p, items: [...p.items, { desc: "", qty: 1, rate: 0 }] }))}>Add Item</Btn>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 16, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0" }}>
            Total: {formatCurrency(newInvoice.items.reduce((a, it) => a + it.qty * it.rate, 0))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="secondary" onClick={() => setShowNew(false)}>Cancel</Btn>
            <Btn onClick={createInvoice}>Create Invoice</Btn>
          </div>
        </div>
      </Modal>

      {/* View Invoice Modal */}
      <Modal isOpen={selectedInv !== null} onClose={() => setSelectedInv(null)} title={selectedInv?.number || ""} width="650px">
        {selectedInv && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div><span style={{ color: "#888", fontSize: 12 }}>Client:</span><div style={{ color: "#f0f0f0", fontSize: 14 }}>{selectedInv.client}</div></div>
              <div><span style={{ color: "#888", fontSize: 12 }}>Email:</span><div style={{ color: "#f0f0f0", fontSize: 14 }}>{selectedInv.email}</div></div>
              <div><span style={{ color: "#888", fontSize: 12 }}>Date:</span><div style={{ color: "#f0f0f0", fontSize: 14 }}>{formatDate(selectedInv.date)}</div></div>
              <div><span style={{ color: "#888", fontSize: 12 }}>Due:</span><div style={{ color: "#f0f0f0", fontSize: 14 }}>{formatDate(selectedInv.dueDate)}</div></div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
              <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <th style={{ textAlign: "left", padding: 8, fontSize: 12, color: "#888" }}>Description</th>
                <th style={{ textAlign: "right", padding: 8, fontSize: 12, color: "#888" }}>Qty</th>
                <th style={{ textAlign: "right", padding: 8, fontSize: 12, color: "#888" }}>Rate</th>
                <th style={{ textAlign: "right", padding: 8, fontSize: 12, color: "#888" }}>Amount</th>
              </tr></thead>
              <tbody>
                {selectedInv.items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: 8, color: "#ccc", fontSize: 13 }}>{it.desc}</td>
                    <td style={{ padding: 8, textAlign: "right", color: "#ccc", fontSize: 13 }}>{it.qty}</td>
                    <td style={{ padding: 8, textAlign: "right", color: "#ccc", fontSize: 13, fontFamily: "monospace" }}>{formatCurrency(it.rate)}</td>
                    <td style={{ padding: 8, textAlign: "right", color: "#f0f0f0", fontSize: 13, fontFamily: "monospace", fontWeight: 600 }}>{formatCurrency(it.qty * it.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: "right", fontSize: 18, fontWeight: 700, color: "#f0f0f0", fontFamily: "monospace" }}>
              Total: {formatCurrency(selectedInv.items.reduce((a, it) => a + it.qty * it.rate, 0))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              {selectedInv.status === "draft" && <Btn onClick={() => { setInvoices(prev => prev.map(inv => inv.id === selectedInv.id ? { ...inv, status: "sent" } : inv)); setSelectedInv(null); }}>Send Invoice</Btn>}
              {selectedInv.status === "sent" && <Btn variant="success" onClick={() => { setInvoices(prev => prev.map(inv => inv.id === selectedInv.id ? { ...inv, status: "paid", paidDate: new Date().toISOString().split("T")[0] } : inv)); setSelectedInv(null); }}>Mark Paid</Btn>}
              <Btn variant="secondary" icon="download">Export PDF</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: AI AGENT - Process emails/voice/text into inquiries
// ═══════════════════════════════════════════════════════

const AIAgent = ({ inquiries, setInquiries, onSendToProposals }) => {
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [outputMode, setOutputMode] = useState("inquiry"); // "inquiry" or "proposal"
  const [proposalData, setProposalData] = useState(null);
  const [generatedProposal, setGeneratedProposal] = useState("");
  const recognitionRef = useRef(null);

  // Parse text to extract inquiry information
  const parseInquiryText = (text) => {
    const data = {
      name: "",
      contact: "",
      email: "",
      phone: "",
      date: "",
      time: "",
      location: "",
      guests: "",
      value: 0,
      serviceType: "",
      notes: "",
      source: "",
      rawText: text,
    };

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const fullText = text.toLowerCase();

    // Extract event name - look for patterns
    const eventNamePatterns = [
      /event\s*(?:named?|:)\s*([^\n]+)/i,
      /for\s+event\s+([^\n]+?)(?:\s+on\s+)/i,
      /(?:event|gig|show|performance):\s*([^\n]+)/i,
      /subject:\s*([^\n]+)/i,
    ];
    for (const pattern of eventNamePatterns) {
      const match = text.match(pattern);
      if (match) { data.name = match[1].trim().replace(/\s+on\s+.*/i, ''); break; }
    }

    // Extract contact name
    const contactPatterns = [
      /(?:contact|client|from|submitted by):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /(?:Hi|Hello|Dear)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    ];
    for (const pattern of contactPatterns) {
      const match = text.match(pattern);
      if (match && !match[1].toLowerCase().includes('team')) { data.contact = match[1].trim(); break; }
    }

    // Extract email
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) data.email = emailMatch[1];

    // Extract phone
    const phoneMatch = text.match(/(?:phone|tel|call|mobile)?:?\s*(\+?[\d\s\-().]{10,})/i);
    if (phoneMatch) data.phone = phoneMatch[1].trim();

    // Extract date - look for various formats
    const datePatterns = [
      /(?:date|on|scheduled for):\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
      /(?:on\s+)?([A-Za-z]+(?:day)?\s+[A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      /([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    ];
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = match[1].trim();
        const parsed = new Date(dateStr.replace(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*/i, ''));
        if (!isNaN(parsed.getTime())) {
          data.date = parsed.toISOString().split('T')[0];
          break;
        }
      }
    }

    // Extract time
    const timeMatch = text.match(/(?:time|from|start):\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:[-–]|to)?\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)?/i);
    if (timeMatch) {
      data.time = timeMatch[1] + (timeMatch[2] ? ` - ${timeMatch[2]}` : '');
    }

    // Extract location/venue
    const locationPatterns = [
      /(?:location|venue|at|place):\s*([^\n,]+(?:,\s*[^\n]+)?)/i,
      /(?:at\s+(?:the\s+)?)([\w\s]+(?:ballroom|hall|center|hotel|venue|room|park|club))/i,
    ];
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) { data.location = match[1].trim(); break; }
    }

    // Extract guest count
    const guestMatch = text.match(/(?:approximately\s+)?(\d+)\s*(?:guests?|attendees?|people|pax)/i);
    if (guestMatch) data.guests = guestMatch[1];

    // Extract budget/value
    const valuePatterns = [
      /\$\s*([\d,]+(?:\.\d{2})?)/,
      /USD\s*([\d,]+(?:\.\d{2})?)/i,
      /(?:budget|rate|fee|paid|price)(?:\s*(?:of|:))?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    ];
    for (const pattern of valuePatterns) {
      const match = text.match(pattern);
      if (match) {
        data.value = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }

    // Extract service type
    const servicePatterns = [
      /for\s+((?:roaming\s+)?(?:magician|magic|dj|band|photographer|videographer|caterer|florist|decorator|entertainer|performer|speaker|mc|host))/i,
      /(?:looking for|need|want|hire)\s+(?:a\s+)?((?:roaming\s+)?(?:magician|magic|dj|band|photographer|videographer|caterer|florist|decorator|entertainer|performer|speaker|mc|host))/i,
      /(?:magician|magic|dj|band|photographer|videographer|caterer|florist|decorator|entertainer|performer|speaker|mc|host)/i,
    ];
    for (const pattern of servicePatterns) {
      const match = text.match(pattern);
      if (match) { data.serviceType = match[1] || match[0]; break; }
    }

    // Extract source (platform/agency)
    const sourcePatterns = [
      /^([A-Z][a-zA-Z\s]+(?:Productions?|Agency|Events?|Entertainment))/m,
      /(?:via|from|through)\s+([A-Z][a-zA-Z\s]+(?:Productions?|Agency|Events?|Entertainment))/i,
    ];
    for (const pattern of sourcePatterns) {
      const match = text.match(pattern);
      if (match) { data.source = match[1].trim(); break; }
    }

    // Build notes from remaining important info
    const noteParts = [];
    if (data.serviceType) noteParts.push(`Service: ${data.serviceType}`);
    if (data.guests) noteParts.push(`Guests: ${data.guests}`);
    if (data.time) noteParts.push(`Time: ${data.time}`);
    if (data.location) noteParts.push(`Location: ${data.location}`);
    if (data.source) noteParts.push(`Source: ${data.source}`);

    // Look for additional notes
    const notesMatch = text.match(/(?:notes?|comments?|details?)(?:\s*(?:to\s+talent)?:)?\s*([^\n]+(?:\n[^\n]+)*)/i);
    if (notesMatch && notesMatch[1].length > 20) {
      noteParts.push(notesMatch[1].trim().substring(0, 500));
    }

    data.notes = noteParts.join('\n');

    // Generate event name if not found
    if (!data.name && data.contact) {
      data.name = data.serviceType
        ? `${data.contact} - ${data.serviceType}`
        : `${data.contact} Event`;
    }

    return data;
  };

  // Parse text for proposal generation
  const parseProposalText = (text) => {
    const data = {
      clientName: "",
      organizationName: "",
      eventTitle: "",
      audienceDescription: "",
      eventType: "",
      eventContext: "",
      requirements: [],
      themes: [],
      availableDates: [],
      sessionFormat: "",
      duration: "",
      technicalRequirements: [],
      specialNotes: [],
      rawText: text,
    };

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const fullText = text.toLowerCase();

    // Extract organization/client name from first line or patterns
    const orgPatterns = [
      /^(?:event\s+(?:with|for)\s+)?([A-Z][A-Za-z\s&]+?)(?:\s*[-–]\s*|\n|$)/i,
      /(?:client|organization|company|with):\s*([A-Z][A-Za-z\s&]+)/i,
      /^([A-Z][A-Za-z\s&]+)\s+(?:event|retreat|conference|meeting)/i,
    ];
    for (const pattern of orgPatterns) {
      const match = text.match(pattern);
      if (match && match[1].length > 2 && match[1].length < 50) {
        data.organizationName = match[1].trim();
        break;
      }
    }

    // Extract event title
    const eventTitlePatterns = [
      /event\s*(?:title|name)?:\s*([^\n]+)/i,
      /(?:annual|yearly|quarterly)\s+([^\n]+(?:retreat|conference|summit|meeting|gathering))/i,
    ];
    for (const pattern of eventTitlePatterns) {
      const match = text.match(pattern);
      if (match) { data.eventTitle = match[1].trim(); break; }
    }

    // Extract audience description
    const audiencePatterns = [
      /(?:audience|attendees?|participants?|staff)(?:\s+(?:will be|are|includes?|of))?\s*(?::|-)?\s*([^\n]+)/i,
      /([a-z\s,]+(?:workers?|nurses?|doctors?|professionals?|employees?|team members?|managers?|executives?))/i,
    ];
    for (const pattern of audiencePatterns) {
      const match = text.match(pattern);
      if (match) { data.audienceDescription = match[1].trim(); break; }
    }

    // Extract event type/context
    const eventTypePatterns = [
      /(annual|yearly|quarterly|monthly|bi-annual)\s+(retreat|conference|summit|meeting|gathering|celebration|training)/i,
      /(?:it's a|this is a|for a|hosting a)\s+([^\n]+(?:retreat|conference|summit|meeting|event))/i,
    ];
    for (const pattern of eventTypePatterns) {
      const match = text.match(pattern);
      if (match) {
        data.eventType = match[0].trim();
        break;
      }
    }

    // Extract context/background
    const contextPhrases = [];
    if (fullText.includes('death') || fullText.includes('dying') || fullText.includes('hospice')) {
      contextPhrases.push("Healthcare professionals dealing with end-of-life care");
    }
    if (fullText.includes('upbeat') || fullText.includes('positive') || fullText.includes('morale')) {
      contextPhrases.push("Looking for uplifting content");
    }
    if (fullText.includes('stress') || fullText.includes('burnout')) {
      contextPhrases.push("Addressing workplace stress and burnout");
    }
    data.eventContext = contextPhrases.join('. ');

    // Extract requirements
    const requirementKeywords = ['educational', 'entertaining', 'interactive', 'engaging', 'fun', 'informative', 'inspiring', 'motivational', 'upbeat', 'positive'];
    requirementKeywords.forEach(keyword => {
      if (fullText.includes(keyword)) {
        data.requirements.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    });

    // Extract themes/messaging
    const themePatterns = [
      /(?:theme|slogan|message|messaging|focus)(?:\s*(?:is|:|-))?\s*"?([^"\n]+)"?/gi,
      /healing through [a-z]+/gi,
      /(?:quality of life|improve\s+[a-z\s]+moments?)/gi,
    ];
    themePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => {
          const cleaned = m.replace(/^(?:theme|slogan|message|messaging|focus)(?:\s*(?:is|:|-))?\s*"?/i, '').replace(/"$/, '').trim();
          if (cleaned && !data.themes.includes(cleaned)) {
            data.themes.push(cleaned);
          }
        });
      }
    });

    // Extract available dates
    const datePatterns = [
      /(?:available|possible|potential)\s+dates?[:\s]*([^\n]+)/i,
      /\*?([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*[-–,]\s*[A-Za-z]*\s*\d{1,2}(?:st|nd|rd|th)?)?(?:\s*,?\s*\d{4})?(?:\s*[-–]\s*(?:tentative|tbc|confirmed))?)/gi,
      /(?:date options?|dates?)[:\s]*\n?((?:[*•-]\s*[^\n]+\n?)+)/i,
    ];
    lines.forEach(line => {
      if (line.match(/(?:april|may|june|july|august|september|october|november|december|january|february|march)\s+\d{1,2}/i)) {
        const dateLine = line.replace(/^\*\s*/, '').trim();
        if (dateLine && !data.availableDates.includes(dateLine)) {
          data.availableDates.push(dateLine);
        }
      }
    });

    // Extract session format
    const sessionPatterns = [
      /(\d+)\s*(?:x|times?)\s*sessions?/i,
      /(one|two|three|1|2|3)\s+sessions?\s*[-–]?\s*([^\n]+)?/i,
      /(?:morning|afternoon|evening)\s+(?:and|&)\s+(?:morning|afternoon|evening)\s+sessions?/i,
      /half\s+(?:of\s+)?(?:the\s+)?staff\s+in\s+the\s+(?:morning|afternoon)/i,
    ];
    for (const pattern of sessionPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.sessionFormat = match[0].trim();
        break;
      }
    }
    // Look for more session details
    if (fullText.includes('morning') && fullText.includes('afternoon')) {
      if (!data.sessionFormat) data.sessionFormat = "Morning and afternoon sessions";
      if (fullText.includes('half') && fullText.includes('staff')) {
        data.sessionFormat += " (split staff attendance)";
      }
    }

    // Extract duration
    const durationPatterns = [
      /(?:approximately|approx\.?|about|around)?\s*(\d+)\s*(?:minute|min)\s*(?:presentation|session|program)/i,
      /(\d+(?:\s*[-–]\s*\d+)?)\s*(?:minute|min|hour|hr)s?/i,
      /presentation\s*\+\s*Q&A/i,
    ];
    for (const pattern of durationPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.duration = match[0].trim();
        break;
      }
    }

    // Extract technical requirements
    const techRequirements = [];
    const techKeywords = [
      { pattern: /green\s*room/i, label: "Green Room" },
      { pattern: /projector|screen|presentation/i, label: "Projector/Screen" },
      { pattern: /microphone|mic|audio/i, label: "Audio/Microphone" },
      { pattern: /stage|platform/i, label: "Stage/Platform" },
      { pattern: /tables?|chairs?|seating/i, label: "Seating arrangement" },
      { pattern: /parking/i, label: "Parking" },
      { pattern: /meals?|lunch|breakfast|dinner|catering/i, label: "Meals provided" },
    ];
    techKeywords.forEach(({ pattern, label }) => {
      if (pattern.test(text)) {
        techRequirements.push(label);
      }
    });
    data.technicalRequirements = techRequirements;

    // Extract special notes
    const specialNotePatterns = [
      /(?:note|important|please note|keep in mind)[:\s]+([^\n]+)/gi,
      /(?:sticking point|concern|consideration)[:\s]+([^\n]+)/gi,
    ];
    specialNotePatterns.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) data.specialNotes.push(match[1].trim());
      });
    });

    // Generate event title if not found
    if (!data.eventTitle && data.organizationName) {
      data.eventTitle = `${data.organizationName} ${data.eventType || 'Event'}`;
    }

    return data;
  };

  // Generate proposal document from parsed data
  const generateProposal = (data) => {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let proposal = `
═══════════════════════════════════════════════════════════════
                         EVENT PROPOSAL
═══════════════════════════════════════════════════════════════

Date: ${today}
Prepared for: ${data.organizationName || '[Organization Name]'}
Event: ${data.eventTitle || '[Event Title]'}

───────────────────────────────────────────────────────────────
                     PROGRAM OVERVIEW
───────────────────────────────────────────────────────────────

${data.audienceDescription ? `AUDIENCE:\n${data.audienceDescription}\n` : ''}
${data.eventContext ? `CONTEXT:\n${data.eventContext}\n` : ''}
${data.requirements.length > 0 ? `\nPROGRAM REQUIREMENTS:\n${data.requirements.map(r => `  • ${r}`).join('\n')}\n` : ''}
${data.themes.length > 0 ? `\nKEY THEMES & MESSAGING:\n${data.themes.map(t => `  • ${t}`).join('\n')}\n` : ''}

───────────────────────────────────────────────────────────────
                     PROPOSED PROGRAM
───────────────────────────────────────────────────────────────

[PROGRAM TITLE]
An interactive and engaging presentation designed specifically for
${data.audienceDescription || 'your team'}.

PROGRAM HIGHLIGHTS:
${data.requirements.map(r => `  ✓ ${r} content tailored to your audience`).join('\n')}

${data.sessionFormat ? `\nSESSION FORMAT:\n${data.sessionFormat}\n` : ''}
${data.duration ? `\nDURATION:\n${data.duration}\n` : ''}

───────────────────────────────────────────────────────────────
                     AVAILABLE DATES
───────────────────────────────────────────────────────────────

${data.availableDates.length > 0 ? data.availableDates.map(d => `  • ${d}`).join('\n') : 'Please confirm preferred date(s).'}

───────────────────────────────────────────────────────────────
                  TECHNICAL REQUIREMENTS
───────────────────────────────────────────────────────────────

${data.technicalRequirements.length > 0 ? data.technicalRequirements.map(t => `  • ${t}`).join('\n') : '  • Standard presentation setup\n  • Adequate space for audience'}

${data.specialNotes.length > 0 ? `
───────────────────────────────────────────────────────────────
                     SPECIAL NOTES
───────────────────────────────────────────────────────────────

${data.specialNotes.map(n => `  • ${n}`).join('\n')}
` : ''}

───────────────────────────────────────────────────────────────
                      INVESTMENT
───────────────────────────────────────────────────────────────

Program Fee:                              $[AMOUNT]
${data.sessionFormat && data.sessionFormat.includes('2') ? `  (Includes both sessions)\n` : ''}
Travel & Expenses:                        [TBD/Included]

───────────────────────────────────────────────────────────────
                      NEXT STEPS
───────────────────────────────────────────────────────────────

1. Review this proposal
2. Confirm preferred date
3. Sign agreement & submit deposit
4. Pre-event planning call

I look forward to creating a memorable experience for your team!

Best regards,
[YOUR NAME]
[YOUR COMPANY]
[CONTACT INFO]

═══════════════════════════════════════════════════════════════
`;

    return proposal.trim();
  };

  // Process the input text
  const processText = () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);

    setTimeout(() => {
      if (outputMode === "inquiry") {
        const extracted = parseInquiryText(inputText);
        setExtractedData(extracted);
        setProposalData(null);
        setGeneratedProposal("");
      } else {
        const extracted = parseProposalText(inputText);
        setProposalData(extracted);
        setGeneratedProposal(generateProposal(extracted));
        setExtractedData(null);
      }
      setIsProcessing(false);
      setEditMode(true);
    }, 500);
  };

  // Voice recognition
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice recognition is not supported in your browser. Try Chrome or Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputText(transcript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // Save to inquiries
  const saveInquiry = () => {
    if (!extractedData) return;

    const inquiry = {
      id: generateId(),
      name: extractedData.name || "New Inquiry",
      contact: extractedData.contact || "",
      email: extractedData.email || "",
      phone: extractedData.phone || "",
      phase: "new",
      grade: extractedData.value >= 5000 ? "A" : extractedData.value >= 2000 ? "B" : "C",
      date: extractedData.date || "",
      value: extractedData.value || 0,
      notes: extractedData.notes || "",
      nextSteps: "Review inquiry and follow up",
    };

    setInquiries(prev => [...prev, inquiry]);
    setExtractedData(null);
    setInputText("");
    setEditMode(false);
    alert(`Inquiry "${inquiry.name}" saved successfully!`);
  };

  // Update extracted field
  const updateField = (field, value) => {
    setExtractedData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0" }}>AI Agent</h2>
          <p style={{ color: "#888", fontSize: 14 }}>Process emails, voice, or text to extract gig inquiry information or generate proposals</p>
        </div>
        <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 4 }}>
          <button
            onClick={() => setOutputMode("inquiry")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: outputMode === "inquiry" ? "#6366f1" : "transparent",
              color: outputMode === "inquiry" ? "#fff" : "#888",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            Extract Inquiry
          </button>
          <button
            onClick={() => setOutputMode("proposal")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: outputMode === "proposal" ? "#10b981" : "transparent",
              color: outputMode === "proposal" ? "#fff" : "#888",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            Generate Proposal
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: editMode ? "1fr 1fr" : "1fr", gap: 24 }}>
        {/* Input Section */}
        <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0" }}>Input</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn
                variant={isListening ? "danger" : "secondary"}
                icon={isListening ? "stop" : "mic"}
                onClick={isListening ? stopListening : startListening}
              >
                {isListening ? "Stop Recording" : "Voice Input"}
              </Btn>
            </div>
          </div>

          {isListening && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "rgba(239,68,68,0.1)", borderRadius: 8, marginBottom: 16, border: "1px solid rgba(239,68,68,0.2)" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite" }} />
              <span style={{ color: "#ef4444", fontSize: 13 }}>Listening... Speak clearly</span>
            </div>
          )}

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={outputMode === "inquiry"
              ? `Paste an email thread, forward, or type/dictate information about a gig inquiry...

Example:
- Email from booking agency
- Salesforce notification
- Voice note about a new lead
- Any text describing an event inquiry`
              : `Paste notes from a client call, meeting, or email to generate a proposal...

Example:
Event With [Client Name]
- Audience: healthcare professionals, nurses, etc.
- Looking for educational and entertaining content
- Available dates: April 17th, May 15th
- 2 sessions - morning and afternoon
- 60-90 minute presentation + Q&A
- Needs: Green Room, projector/screen`}
            style={{
              width: "100%", minHeight: 300, padding: 16, borderRadius: 10,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#f0f0f0", fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
              resize: "vertical", outline: "none"
            }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn onClick={processText} disabled={!inputText.trim() || isProcessing} icon="sparkle">
              {isProcessing ? "Processing..." : outputMode === "inquiry" ? "Extract Information" : "Generate Proposal"}
            </Btn>
            <Btn variant="secondary" onClick={() => { setInputText(""); setExtractedData(null); setProposalData(null); setGeneratedProposal(""); setEditMode(false); }}>
              Clear
            </Btn>
          </div>

          {/* Quick tips */}
          <div style={{ marginTop: 20, padding: 16, background: outputMode === "inquiry" ? "rgba(99,102,241,0.06)" : "rgba(16,185,129,0.06)", borderRadius: 10, border: outputMode === "inquiry" ? "1px solid rgba(99,102,241,0.15)" : "1px solid rgba(16,185,129,0.15)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: outputMode === "inquiry" ? "#a5b4fc" : "#6ee7b7", marginBottom: 8 }}>Tips for best results:</div>
            {outputMode === "inquiry" ? (
              <ul style={{ margin: 0, paddingLeft: 20, color: "#888", fontSize: 12, lineHeight: 1.6 }}>
                <li>Include the event date (e.g., "April 2, 2026" or "04/02/2026")</li>
                <li>Mention budget or rate (e.g., "$2,500" or "USD 2,500")</li>
                <li>Include guest count (e.g., "200 guests" or "approximately 150 attendees")</li>
                <li>Specify location/venue name</li>
                <li>Include contact email for follow-up</li>
              </ul>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, color: "#888", fontSize: 12, lineHeight: 1.6 }}>
                <li>Include client/organization name</li>
                <li>Describe the audience (e.g., "healthcare workers", "corporate team")</li>
                <li>Note any themes or messaging requirements</li>
                <li>List available dates with any constraints</li>
                <li>Specify session format and duration</li>
                <li>Include technical requirements (green room, AV needs, etc.)</li>
              </ul>
            )}
          </div>
        </div>

        {/* Extracted Data Section */}
        {editMode && extractedData && (
          <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="check" size={18} /> Extracted Information
              </h3>
              <Badge color="#10b981">Ready to Save</Badge>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <Input label="Event Name *" value={extractedData.name} onChange={(v) => updateField("name", v)} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="Contact Name" value={extractedData.contact} onChange={(v) => updateField("contact", v)} />
                <Input label="Email" value={extractedData.email} onChange={(v) => updateField("email", v)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="Phone" value={extractedData.phone} onChange={(v) => updateField("phone", v)} />
                <Input label="Event Date" type="date" value={extractedData.date} onChange={(v) => updateField("date", v)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="Budget ($)" type="number" value={extractedData.value} onChange={(v) => updateField("value", parseFloat(v) || 0)} />
                <Input label="Guest Count" value={extractedData.guests} onChange={(v) => updateField("guests", v)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="Service Type" value={extractedData.serviceType} onChange={(v) => updateField("serviceType", v)} />
                <Input label="Location/Venue" value={extractedData.location} onChange={(v) => updateField("location", v)} />
              </div>

              <Input label="Source/Agency" value={extractedData.source} onChange={(v) => updateField("source", v)} />

              <TextArea label="Notes" value={extractedData.notes} onChange={(v) => updateField("notes", v)} rows={4} />

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Btn onClick={saveInquiry} icon="plus">Save as Inquiry</Btn>
                <Btn variant="secondary" onClick={() => { setEditMode(false); setExtractedData(null); }}>Cancel</Btn>
              </div>
            </div>

            {/* Original text reference */}
            <div style={{ marginTop: 20, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Original Text</div>
              <div style={{ fontSize: 11, color: "#888", maxHeight: 100, overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: "'JetBrains Mono', monospace" }}>
                {extractedData.rawText}
              </div>
            </div>
          </div>
        )}

        {/* Proposal Generation Section */}
        {editMode && proposalData && generatedProposal && (
          <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(16,185,129,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="document" size={18} /> Generated Proposal
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <Badge color="#10b981">Ready to Edit</Badge>
              </div>
            </div>

            {/* Extracted Details Summary */}
            <div style={{ marginBottom: 20, padding: 16, background: "rgba(16,185,129,0.06)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.15)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#10b981", marginBottom: 12 }}>Extracted Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {proposalData.organizationName && (
                  <div>
                    <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Organization</div>
                    <div style={{ fontSize: 13, color: "#f0f0f0" }}>{proposalData.organizationName}</div>
                  </div>
                )}
                {proposalData.eventTitle && (
                  <div>
                    <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Event</div>
                    <div style={{ fontSize: 13, color: "#f0f0f0" }}>{proposalData.eventTitle}</div>
                  </div>
                )}
                {proposalData.audienceDescription && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Audience</div>
                    <div style={{ fontSize: 13, color: "#f0f0f0" }}>{proposalData.audienceDescription}</div>
                  </div>
                )}
                {proposalData.requirements.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Requirements</div>
                    <div style={{ fontSize: 13, color: "#f0f0f0" }}>{proposalData.requirements.join(", ")}</div>
                  </div>
                )}
                {proposalData.duration && (
                  <div>
                    <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Duration</div>
                    <div style={{ fontSize: 13, color: "#f0f0f0" }}>{proposalData.duration}</div>
                  </div>
                )}
                {proposalData.sessionFormat && (
                  <div>
                    <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Sessions</div>
                    <div style={{ fontSize: 13, color: "#f0f0f0" }}>{proposalData.sessionFormat}</div>
                  </div>
                )}
                {proposalData.availableDates.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Available Dates</div>
                    <div style={{ fontSize: 13, color: "#f0f0f0" }}>{proposalData.availableDates.join(", ")}</div>
                  </div>
                )}
                {proposalData.technicalRequirements.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Technical Requirements</div>
                    <div style={{ fontSize: 13, color: "#f0f0f0" }}>{proposalData.technicalRequirements.join(", ")}</div>
                  </div>
                )}
                {proposalData.themes.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Themes/Messaging</div>
                    <div style={{ fontSize: 13, color: "#f0f0f0" }}>{proposalData.themes.join(", ")}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Proposal Text Area */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Edit the generated proposal below:</div>
              <textarea
                value={generatedProposal}
                onChange={(e) => setGeneratedProposal(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 400,
                  padding: 16,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#f0f0f0",
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: 1.5
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn
                onClick={() => {
                  if (onSendToProposals) {
                    onSendToProposals({
                      id: generateId(),
                      title: proposalData.eventTitle || proposalData.organizationName || "New Proposal",
                      client: proposalData.organizationName || "",
                      content: generatedProposal,
                      extractedData: proposalData,
                      status: "draft",
                      createdDate: new Date().toISOString(),
                      lastModified: new Date().toISOString(),
                    });
                    setEditMode(false);
                    setProposalData(null);
                    setGeneratedProposal("");
                    setInputText("");
                  }
                }}
                icon="send"
              >
                Send to Proposal Editor
              </Btn>
              <Btn
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(generatedProposal);
                  alert("Proposal copied to clipboard!");
                }}
                icon="copy"
              >
                Copy to Clipboard
              </Btn>
              <Btn
                variant="secondary"
                onClick={() => {
                  const blob = new Blob([generatedProposal], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `proposal-${proposalData.organizationName?.replace(/\s+/g, '-').toLowerCase() || 'draft'}-${new Date().toISOString().split('T')[0]}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                icon="download"
              >
                Download as Text
              </Btn>
              <Btn
                variant="secondary"
                onClick={() => setGeneratedProposal(generateProposal(proposalData))}
                icon="refresh"
              >
                Regenerate
              </Btn>
              <Btn
                variant="secondary"
                onClick={() => { setEditMode(false); setProposalData(null); setGeneratedProposal(""); }}
              >
                Cancel
              </Btn>
            </div>

            {/* Original text reference */}
            <div style={{ marginTop: 20, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Original Input</div>
              <div style={{ fontSize: 11, color: "#888", maxHeight: 100, overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: "'JetBrains Mono', monospace" }}>
                {proposalData.rawText}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent inquiries created */}
      {inquiries.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#888", marginBottom: 16 }}>Recent Inquiries ({inquiries.length})</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {inquiries.slice(0, 6).map(inq => (
              <div key={inq.id} style={{ background: "#1a1d23", borderRadius: 10, padding: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0" }}>{inq.name}</div>
                  <Badge color={inq.grade === "A" ? "#10b981" : inq.grade === "B" ? "#f59e0b" : "#888"}>{inq.grade}</Badge>
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>{inq.contact}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                  <span style={{ color: "#6366f1" }}>{formatDate(inq.date)}</span>
                  <span style={{ color: "#10b981", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(inq.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: PROPOSAL EDITOR
// ═══════════════════════════════════════════════════════

const ProposalEditor = ({ proposals, setProposals }) => {
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null, "saved", "error"
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const editorRef = useRef(null);

  // Proposal template settings
  const [companySettings, setCompanySettings] = useState(() => {
    const saved = localStorage.getItem("sg_proposalSettings");
    return saved ? JSON.parse(saved) : {
      companyName: "Your Company Name",
      contactName: "Your Name",
      email: "email@company.com",
      phone: "(555) 123-4567",
      website: "www.yourcompany.com",
      logo: null,
      accentColor: "#6366f1"
    };
  });

  const [showSettings, setShowSettings] = useState(false);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem("sg_proposalSettings", JSON.stringify(companySettings));
  }, [companySettings]);

  // Select a proposal for editing
  const handleSelectProposal = (proposal) => {
    setSelectedProposal(proposal);
    setEditedContent(proposal.content);
    setShowPreview(false);
    setHasUnsavedChanges(false);
    setSaveStatus(null);
  };

  // Track content changes
  const handleContentChange = (newContent) => {
    setEditedContent(newContent);
    setHasUnsavedChanges(newContent !== selectedProposal?.content);
    setSaveStatus(null);
  };

  // Save changes to proposal
  const handleSaveChanges = () => {
    if (!selectedProposal) return;
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const updated = {
        ...selectedProposal,
        content: editedContent,
        lastModified: new Date().toISOString()
      };

      // Update state immediately
      setProposals(prev => prev.map(p => p.id === selectedProposal.id ? updated : p));
      setSelectedProposal(updated);
      setHasUnsavedChanges(false);
      setSaveStatus("saved");

      // Clear the saved status after 3 seconds
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error("Error saving proposal:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  // Update proposal status
  const handleUpdateStatus = (status) => {
    if (!selectedProposal) return;
    const updated = { ...selectedProposal, status, lastModified: new Date().toISOString() };
    setProposals(prev => prev.map(p => p.id === selectedProposal.id ? updated : p));
    setSelectedProposal(updated);
  };

  // Delete proposal
  const handleDeleteProposal = (id) => {
    if (!confirm("Are you sure you want to delete this proposal?")) return;
    setProposals(prev => prev.filter(p => p.id !== id));
    if (selectedProposal?.id === id) {
      setSelectedProposal(null);
      setEditedContent("");
    }
  };

  // Format proposal content for PDF - convert ASCII to styled HTML
  const formatProposalForPDF = (content) => {
    // Replace ASCII box drawing with styled sections
    let formatted = content
      // Remove ASCII box characters
      .replace(/═+/g, '')
      .replace(/─+/g, '')
      // Convert section headers
      .replace(/^(\s*)([A-Z][A-Z\s&]+)$/gm, (match, space, title) => {
        const trimmed = title.trim();
        if (trimmed === 'EVENT PROPOSAL') {
          return `<h1 class="proposal-title">${trimmed}</h1>`;
        }
        return `<h2 class="section-header">${trimmed}</h2>`;
      })
      // Convert bullet points
      .replace(/^\s*[•✓]\s*(.+)$/gm, '<li>$1</li>')
      // Convert lines starting with checkmarks
      .replace(/^\s*✓\s*(.+)$/gm, '<li class="check">$1</li>')
      // Wrap consecutive list items
      .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      // Convert key-value pairs
      .replace(/^([A-Z][A-Za-z\s]+):\s*(.+)$/gm, '<p><strong>$1:</strong> $2</p>')
      // Preserve line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return formatted;
  };

  // Generate PDF using browser print
  const handleExportPDF = async () => {
    setIsExporting(true);

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF');
      setIsExporting(false);
      return;
    }

    const proposalHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${selectedProposal?.title || 'Proposal'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    @page {
      size: letter;
      margin: 0.75in;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1f2937;
      background: white;
    }

    .proposal-container {
      max-width: 100%;
      padding: 0;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 3px solid ${companySettings.accentColor};
      margin-bottom: 32px;
    }

    .company-info h1 {
      font-size: 24pt;
      font-weight: 700;
      color: ${companySettings.accentColor};
      margin-bottom: 4px;
    }

    .company-info p {
      font-size: 10pt;
      color: #6b7280;
    }

    .proposal-meta {
      text-align: right;
      font-size: 10pt;
      color: #6b7280;
    }

    .proposal-meta strong {
      color: #1f2937;
      display: block;
      font-size: 11pt;
    }

    .proposal-title {
      font-size: 20pt;
      font-weight: 700;
      color: #1f2937;
      text-align: center;
      margin: 32px 0;
      padding: 16px;
      background: linear-gradient(135deg, ${companySettings.accentColor}10, ${companySettings.accentColor}05);
      border-radius: 8px;
    }

    .section-header {
      font-size: 13pt;
      font-weight: 600;
      color: ${companySettings.accentColor};
      margin-top: 28px;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid ${companySettings.accentColor}30;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .content {
      white-space: pre-wrap;
      font-size: 11pt;
      line-height: 1.7;
    }

    .content p {
      margin-bottom: 8px;
    }

    .content ul {
      margin: 12px 0;
      padding-left: 24px;
    }

    .content li {
      margin-bottom: 6px;
    }

    .content li.check::marker {
      content: "✓ ";
      color: ${companySettings.accentColor};
    }

    .highlight-box {
      background: ${companySettings.accentColor}08;
      border-left: 4px solid ${companySettings.accentColor};
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }

    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 10pt;
      color: #6b7280;
    }

    .footer strong {
      color: ${companySettings.accentColor};
    }

    .signature-line {
      margin-top: 48px;
      display: flex;
      justify-content: space-between;
      gap: 48px;
    }

    .signature-block {
      flex: 1;
      text-align: center;
    }

    .signature-block .line {
      border-top: 1px solid #1f2937;
      margin-bottom: 8px;
      margin-top: 48px;
    }

    .signature-block p {
      font-size: 10pt;
      color: #6b7280;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="proposal-container">
    <div class="header">
      <div class="company-info" style="display: flex; align-items: center; gap: 16px;">
        ${companySettings.logo ? `<img src="${companySettings.logo}" alt="Logo" style="width: 70px; height: 70px; object-fit: contain;" />` : ''}
        <div>
          <h1>${companySettings.companyName}</h1>
          <p>${companySettings.contactName}</p>
          <p>${companySettings.email} | ${companySettings.phone}</p>
          ${companySettings.website ? `<p>${companySettings.website}</p>` : ''}
        </div>
      </div>
      <div class="proposal-meta">
        <strong>PROPOSAL</strong>
        <p>Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p>Prepared for: ${selectedProposal?.client || 'Client'}</p>
      </div>
    </div>

    <div class="content">
      ${formatProposalForPDF(editedContent)}
    </div>

    <div class="signature-line">
      <div class="signature-block">
        <div class="line"></div>
        <p>Client Signature</p>
        <p style="margin-top: 4px; color: #9ca3af;">Date: _______________</p>
      </div>
      <div class="signature-block">
        <div class="line"></div>
        <p>${companySettings.contactName}</p>
        <p style="margin-top: 4px; color: #9ca3af;">${companySettings.companyName}</p>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for considering <strong>${companySettings.companyName}</strong></p>
      <p style="margin-top: 4px;">${companySettings.email} | ${companySettings.phone}</p>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 250);
    };
  </script>
</body>
</html>`;

    printWindow.document.write(proposalHTML);
    printWindow.document.close();

    setTimeout(() => setIsExporting(false), 1000);
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return '#6b7280';
      case 'sent': return '#3b82f6';
      case 'accepted': return '#10b981';
      case 'declined': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0" }}>Proposal Editor</h2>
          <p style={{ color: "#888", fontSize: 14 }}>Edit, preview, and export professional proposals</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" icon="settings" onClick={() => setShowSettings(!showSettings)}>
            Settings
          </Btn>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, marginBottom: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 16 }}>Company Settings</h3>
          <p style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>These details will appear on your exported proposals</p>

          {/* Logo Upload Section */}
          <div style={{ marginBottom: 24, padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 12 }}>Company Logo</label>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {companySettings.logo ? (
                <div style={{ position: "relative" }}>
                  <img
                    src={companySettings.logo}
                    alt="Company Logo"
                    style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 8 }}
                  />
                  <button
                    onClick={() => setCompanySettings(prev => ({ ...prev, logo: null }))}
                    style={{
                      position: "absolute", top: -8, right: -8, width: 24, height: 24,
                      borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: "bold"
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div style={{
                  width: 80, height: 80, borderRadius: 8, border: "2px dashed rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#666"
                }}>
                  <Icon name="image" size={32} />
                </div>
              )}
              <div>
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 2 * 1024 * 1024) {
                        alert("Logo must be less than 2MB");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setCompanySettings(prev => ({ ...prev, logo: event.target.result }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <label
                  htmlFor="logo-upload"
                  style={{
                    display: "inline-block", padding: "8px 16px", background: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#a5b4fc",
                    fontSize: 13, cursor: "pointer", fontWeight: 500
                  }}
                >
                  {companySettings.logo ? "Change Logo" : "Upload Logo"}
                </label>
                <p style={{ fontSize: 11, color: "#666", marginTop: 8 }}>PNG, JPG up to 2MB. Will appear on PDF exports.</p>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input label="Company Name" value={companySettings.companyName} onChange={(v) => setCompanySettings(prev => ({ ...prev, companyName: v }))} />
            <Input label="Contact Name" value={companySettings.contactName} onChange={(v) => setCompanySettings(prev => ({ ...prev, contactName: v }))} />
            <Input label="Email" value={companySettings.email} onChange={(v) => setCompanySettings(prev => ({ ...prev, email: v }))} />
            <Input label="Phone" value={companySettings.phone} onChange={(v) => setCompanySettings(prev => ({ ...prev, phone: v }))} />
            <Input label="Website" value={companySettings.website} onChange={(v) => setCompanySettings(prev => ({ ...prev, website: v }))} />
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Accent Color</label>
              <input
                type="color"
                value={companySettings.accentColor}
                onChange={(e) => setCompanySettings(prev => ({ ...prev, accentColor: e.target.value }))}
                style={{ width: "100%", height: 40, border: "none", borderRadius: 8, cursor: "pointer" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: "grid", gridTemplateColumns: selectedProposal ? "300px 1fr" : "1fr", gap: 24 }}>
        {/* Proposals List */}
        <div style={{ background: "#1a1d23", borderRadius: 14, padding: 20, border: "1px solid rgba(255,255,255,0.05)", maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#888", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Proposals ({proposals.length})
          </h3>

          {proposals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#666" }}>
              <Icon name="document" size={48} />
              <p style={{ marginTop: 16, fontSize: 14 }}>No proposals yet</p>
              <p style={{ fontSize: 12, color: "#555", marginTop: 8 }}>Use the AI Agent to generate your first proposal</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {proposals.map(proposal => (
                <div
                  key={proposal.id}
                  onClick={() => handleSelectProposal(proposal)}
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    background: selectedProposal?.id === proposal.id ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)",
                    border: selectedProposal?.id === proposal.id ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.05)",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", flex: 1, marginRight: 8 }}>{proposal.title}</div>
                    <Badge color={getStatusColor(proposal.status)}>{proposal.status}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "#888" }}>{proposal.client}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
                    {new Date(proposal.lastModified || proposal.createdDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor / Preview Panel */}
        {selectedProposal && (
          <div style={{ background: "#1a1d23", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
            {/* Editor Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <Input
                  value={selectedProposal.title}
                  onChange={(v) => {
                    const updated = { ...selectedProposal, title: v };
                    setSelectedProposal(updated);
                    setProposals(prev => prev.map(p => p.id === selectedProposal.id ? updated : p));
                  }}
                  style={{ fontSize: 18, fontWeight: 600, background: "transparent", border: "none", padding: 0, color: "#f0f0f0" }}
                />
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  Last modified: {new Date(selectedProposal.lastModified || selectedProposal.createdDate).toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={selectedProposal.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#f0f0f0",
                    fontSize: 13,
                    cursor: "pointer"
                  }}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                </select>
                <Btn variant="secondary" icon="trash" onClick={() => handleDeleteProposal(selectedProposal.id)} />
              </div>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setShowPreview(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: !showPreview ? "#6366f1" : "rgba(255,255,255,0.05)",
                  color: !showPreview ? "#fff" : "#888",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                Edit
              </button>
              <button
                onClick={() => setShowPreview(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: showPreview ? "#10b981" : "rgba(255,255,255,0.05)",
                  color: showPreview ? "#fff" : "#888",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                Preview
              </button>
            </div>

            {/* Content Area */}
            {!showPreview ? (
              <div>
                {/* Unsaved changes indicator */}
                {hasUnsavedChanges && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: "rgba(245,158,11,0.1)",
                    borderRadius: 8,
                    marginBottom: 12,
                    border: "1px solid rgba(245,158,11,0.2)"
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                    <span style={{ fontSize: 12, color: "#f59e0b" }}>Unsaved changes</span>
                  </div>
                )}

                {/* Rich Text Formatting Toolbar */}
                <div style={{
                  display: "flex",
                  gap: 4,
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "10px 10px 0 0",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderBottom: "none",
                  flexWrap: "wrap"
                }}>
                  {/* Text Formatting */}
                  <div style={{ display: "flex", gap: 2, paddingRight: 8, borderRight: "1px solid rgba(255,255,255,0.1)" }}>
                    <button
                      onClick={() => document.execCommand('bold')}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}
                      title="Bold (Ctrl+B)"
                    >
                      B
                    </button>
                    <button
                      onClick={() => document.execCommand('italic')}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 13, cursor: "pointer", fontStyle: "italic" }}
                      title="Italic (Ctrl+I)"
                    >
                      I
                    </button>
                    <button
                      onClick={() => document.execCommand('underline')}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
                      title="Underline (Ctrl+U)"
                    >
                      U
                    </button>
                  </div>

                  {/* Headings */}
                  <div style={{ display: "flex", gap: 2, paddingRight: 8, borderRight: "1px solid rgba(255,255,255,0.1)" }}>
                    <button
                      onClick={() => document.execCommand('formatBlock', false, 'h2')}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 12, cursor: "pointer" }}
                      title="Heading"
                    >
                      H1
                    </button>
                    <button
                      onClick={() => document.execCommand('formatBlock', false, 'h3')}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 11, cursor: "pointer" }}
                      title="Subheading"
                    >
                      H2
                    </button>
                    <button
                      onClick={() => document.execCommand('formatBlock', false, 'p')}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 11, cursor: "pointer" }}
                      title="Normal text"
                    >
                      ¶
                    </button>
                  </div>

                  {/* Lists */}
                  <div style={{ display: "flex", gap: 2, paddingRight: 8, borderRight: "1px solid rgba(255,255,255,0.1)" }}>
                    <button
                      onClick={() => document.execCommand('insertUnorderedList')}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 12, cursor: "pointer" }}
                      title="Bullet List"
                    >
                      • List
                    </button>
                    <button
                      onClick={() => document.execCommand('insertOrderedList')}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 12, cursor: "pointer" }}
                      title="Numbered List"
                    >
                      1. List
                    </button>
                  </div>

                  {/* Alignment */}
                  <div style={{ display: "flex", gap: 2, paddingRight: 8, borderRight: "1px solid rgba(255,255,255,0.1)" }}>
                    <button
                      onClick={() => document.execCommand('justifyLeft')}
                      style={{ padding: "6px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 11, cursor: "pointer" }}
                      title="Align Left"
                    >
                      ≡
                    </button>
                    <button
                      onClick={() => document.execCommand('justifyCenter')}
                      style={{ padding: "6px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 11, cursor: "pointer" }}
                      title="Align Center"
                    >
                      ≡
                    </button>
                    <button
                      onClick={() => document.execCommand('justifyRight')}
                      style={{ padding: "6px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 11, cursor: "pointer" }}
                      title="Align Right"
                    >
                      ≡
                    </button>
                  </div>

                  {/* Special */}
                  <div style={{ display: "flex", gap: 2 }}>
                    <button
                      onClick={() => document.execCommand('insertHorizontalRule')}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 11, cursor: "pointer" }}
                      title="Horizontal Line"
                    >
                      ─
                    </button>
                    <button
                      onClick={() => {
                        const color = prompt('Enter color (e.g., #6366f1 or red):');
                        if (color) document.execCommand('foreColor', false, color);
                      }}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#ccc", fontSize: 11, cursor: "pointer" }}
                      title="Text Color"
                    >
                      A
                    </button>
                    <button
                      onClick={() => document.execCommand('removeFormat')}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#888", fontSize: 11, cursor: "pointer" }}
                      title="Clear Formatting"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Rich Text Editor */}
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={(e) => {
                    const content = e.currentTarget.innerHTML;
                    setEditedContent(content);
                    setHasUnsavedChanges(content !== selectedProposal?.content);
                    setSaveStatus(null);
                  }}
                  onKeyDown={(e) => {
                    // Ctrl/Cmd + S to save
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                      e.preventDefault();
                      handleSaveChanges();
                    }
                  }}
                  onPaste={(e) => {
                    // Handle paste to strip formatting if needed
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
                    document.execCommand('insertHTML', false, text);
                  }}
                  dangerouslySetInnerHTML={{ __html: editedContent }}
                  style={{
                    width: "100%",
                    minHeight: 450,
                    padding: 20,
                    borderRadius: "0 0 10px 10px",
                    background: "rgba(255,255,255,0.03)",
                    border: hasUnsavedChanges ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.08)",
                    borderTop: "none",
                    color: "#f0f0f0",
                    fontSize: 14,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                    outline: "none",
                    lineHeight: 1.7,
                    overflowY: "auto",
                    maxHeight: 500
                  }}
                  suppressContentEditableWarning={true}
                />

                {/* Editor Info */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 11, color: "#666" }}>
                  <span>Rich text editor • Ctrl+B Bold • Ctrl+I Italic • Ctrl+S Save</span>
                  <span>{editedContent.replace(/<[^>]*>/g, '').length} characters</span>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <Btn
                    onClick={handleSaveChanges}
                    disabled={isSaving || !hasUnsavedChanges}
                    icon={saveStatus === "saved" ? "check" : "check"}
                    variant={saveStatus === "saved" ? "success" : undefined}
                  >
                    {isSaving ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Changes"}
                  </Btn>
                  <Btn
                    variant="secondary"
                    onClick={() => {
                      setEditedContent(selectedProposal.content);
                      setHasUnsavedChanges(false);
                      setSaveStatus(null);
                    }}
                    disabled={!hasUnsavedChanges}
                  >
                    Revert
                  </Btn>
                  {saveStatus === "saved" && (
                    <span style={{ fontSize: 12, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon name="check" size={14} /> Changes saved successfully
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span style={{ fontSize: 12, color: "#ef4444" }}>Error saving changes</span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {/* PDF-like Preview */}
                <div style={{
                  background: "#fff",
                  color: "#1f2937",
                  padding: 48,
                  borderRadius: 8,
                  minHeight: 500,
                  maxHeight: 600,
                  overflowY: "auto",
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
                }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 20, borderBottom: `3px solid ${companySettings.accentColor}`, marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {companySettings.logo && (
                        <img src={companySettings.logo} alt="Logo" style={{ width: 60, height: 60, objectFit: "contain" }} />
                      )}
                      <div>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: companySettings.accentColor, marginBottom: 4 }}>{companySettings.companyName}</h1>
                        <p style={{ fontSize: 12, color: "#6b7280" }}>{companySettings.contactName}</p>
                        <p style={{ fontSize: 12, color: "#6b7280" }}>{companySettings.email} | {companySettings.phone}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ fontSize: 14 }}>PROPOSAL</strong>
                      <p style={{ fontSize: 11, color: "#6b7280" }}>Date: {new Date().toLocaleDateString()}</p>
                      <p style={{ fontSize: 11, color: "#6b7280" }}>Prepared for: {selectedProposal.client}</p>
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.7 }}>
                    {editedContent}
                  </div>
                </div>

                {/* Export Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <Btn onClick={handleExportPDF} disabled={isExporting} icon="download">
                    {isExporting ? "Preparing..." : "Export as PDF"}
                  </Btn>
                  <Btn
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(editedContent);
                      alert("Proposal copied to clipboard!");
                    }}
                    icon="copy"
                  >
                    Copy Text
                  </Btn>
                </div>
              </div>
            )}

            {/* Extracted Data Reference (if available) */}
            {selectedProposal.extractedData && (
              <div style={{ marginTop: 24, padding: 16, background: "rgba(99,102,241,0.06)", borderRadius: 10, border: "1px solid rgba(99,102,241,0.15)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a5b4fc", marginBottom: 12 }}>Original Extracted Data</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
                  {selectedProposal.extractedData.organizationName && (
                    <div><span style={{ color: "#666" }}>Organization:</span> <span style={{ color: "#f0f0f0" }}>{selectedProposal.extractedData.organizationName}</span></div>
                  )}
                  {selectedProposal.extractedData.audienceDescription && (
                    <div><span style={{ color: "#666" }}>Audience:</span> <span style={{ color: "#f0f0f0" }}>{selectedProposal.extractedData.audienceDescription}</span></div>
                  )}
                  {selectedProposal.extractedData.duration && (
                    <div><span style={{ color: "#666" }}>Duration:</span> <span style={{ color: "#f0f0f0" }}>{selectedProposal.extractedData.duration}</span></div>
                  )}
                  {selectedProposal.extractedData.sessionFormat && (
                    <div><span style={{ color: "#666" }}>Sessions:</span> <span style={{ color: "#f0f0f0" }}>{selectedProposal.extractedData.sessionFormat}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no proposal selected */}
        {!selectedProposal && proposals.length > 0 && (
          <div style={{ background: "#1a1d23", borderRadius: 14, padding: 48, border: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <Icon name="document" size={64} />
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0", marginTop: 24 }}>Select a Proposal</h3>
            <p style={{ color: "#888", fontSize: 14, marginTop: 8 }}>Choose a proposal from the list to edit, preview, or export</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: UPCOMING GIGS
// ═══════════════════════════════════════════════════════

const UpcomingGigs = ({ events, contracts, invoices }) => {
  const [selectedGig, setSelectedGig] = useState(null);
  const [contractInputRef] = useState(useRef(null));

  // Combine events/contracts into upcoming gigs, sorted by date
  const upcomingGigs = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return events
      .filter(e => e.date >= today)
      .map(e => {
        const contract = contracts.find(c => c.eventName === e.name);
        const invoice = invoices.find(i => i.client === e.client && i.items?.some(item => item.desc?.includes(e.name)));
        return { ...e, contract, invoice };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, contracts, invoices]);

  // Calculate days until event
  const daysUntil = (date) => {
    const eventDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff < 7) return `${diff} days`;
    if (diff < 30) return `${Math.ceil(diff / 7)} weeks`;
    return `${Math.ceil(diff / 30)} months`;
  };

  // Get status color
  const getStatusColor = (gig) => {
    const days = Math.ceil((new Date(gig.date + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24));
    if (days <= 7) return "#ef4444"; // Red - urgent
    if (days <= 30) return "#f59e0b"; // Orange - soon
    return "#10b981"; // Green - plenty of time
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Upcoming Gigs</h1>
          <p style={{ color: "#888", fontSize: 14 }}>Your confirmed events at a glance</p>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#6366f1" }}>{upcomingGigs.length}</div>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Upcoming</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{formatCurrency(upcomingGigs.reduce((s, g) => s + (g.value || 0), 0))}</div>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Total Value</div>
          </div>
        </div>
      </div>

      {upcomingGigs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#666" }}>
          <Icon name="calendar" size={48} />
          <p style={{ marginTop: 16, fontSize: 16 }}>No upcoming gigs</p>
          <p style={{ fontSize: 13 }}>Confirmed inquiries will appear here</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
          {upcomingGigs.map(gig => (
            <div key={gig.id} onClick={() => setSelectedGig(gig)}
              style={{
                background: "#1a1d23", borderRadius: 16, overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer",
                transition: "all 0.2s", position: "relative"
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = getStatusColor(gig) + "66"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              {/* Top accent bar */}
              <div style={{ height: 4, background: getStatusColor(gig) }} />

              <div style={{ padding: 20 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>{gig.name}</h3>
                    <div style={{ fontSize: 13, color: "#888" }}>{gig.client}</div>
                  </div>
                  <Badge color={getStatusColor(gig)}>{daysUntil(gig.date)}</Badge>
                </div>

                {/* Details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Date</div>
                    <div style={{ fontSize: 14, color: "#f0f0f0", fontWeight: 500 }}>{formatDate(gig.date)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Time</div>
                    <div style={{ fontSize: 14, color: "#f0f0f0", fontWeight: 500 }}>{gig.time || "TBD"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Venue</div>
                    <div style={{ fontSize: 14, color: "#f0f0f0", fontWeight: 500 }}>{gig.venue || "TBD"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", marginBottom: 2 }}>Value</div>
                    <div style={{ fontSize: 14, color: "#10b981", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(gig.value)}</div>
                  </div>
                </div>

                {/* Status indicators */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {gig.contract && <Badge color="#6366f1">Contract ✓</Badge>}
                  {gig.invoice && <Badge color={gig.invoice.status === "paid" ? "#10b981" : "#f59e0b"}>
                    Invoice {gig.invoice.status === "paid" ? "Paid" : "Pending"}
                  </Badge>}
                  {gig.guests > 0 && <Badge color="#888">{gig.guests} guests</Badge>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gig Detail Modal */}
      <Modal isOpen={selectedGig !== null} onClose={() => setSelectedGig(null)} title={selectedGig?.name || ""} width="600px">
        {selectedGig && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Client</div>
                <div style={{ fontSize: 16, color: "#f0f0f0" }}>{selectedGig.client}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 16, color: "#6366f1" }}>{selectedGig.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Date & Time</div>
                <div style={{ fontSize: 16, color: "#f0f0f0" }}>{formatDate(selectedGig.date)} at {selectedGig.time || "TBD"}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Venue</div>
                <div style={{ fontSize: 16, color: "#f0f0f0" }}>{selectedGig.venue || "TBD"}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Guests</div>
                <div style={{ fontSize: 16, color: "#f0f0f0" }}>{selectedGig.guests || "TBD"}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Value</div>
                <div style={{ fontSize: 20, color: "#10b981", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(selectedGig.value)}</div>
              </div>
            </div>

            {/* Contract & Invoice Status */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, padding: 16, background: "rgba(99,102,241,0.06)", borderRadius: 10, border: "1px solid rgba(99,102,241,0.15)" }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Contract</div>
                {selectedGig.contract ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="check" size={16} />
                    <span style={{ color: "#10b981" }}>On file</span>
                  </div>
                ) : (
                  <div style={{ color: "#f59e0b" }}>Not uploaded</div>
                )}
              </div>
              <div style={{ flex: 1, padding: 16, background: "rgba(16,185,129,0.06)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.15)" }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Invoice</div>
                {selectedGig.invoice ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge color={selectedGig.invoice.status === "paid" ? "#10b981" : "#f59e0b"}>
                      {selectedGig.invoice.status === "paid" ? "Paid" : selectedGig.invoice.status === "sent" ? "Sent" : "Draft"}
                    </Badge>
                    <span style={{ fontSize: 12, color: "#888" }}>{selectedGig.invoice.number}</span>
                  </div>
                ) : (
                  <div style={{ color: "#888" }}>No invoice</div>
                )}
              </div>
            </div>

            {/* Tasks preview */}
            {selectedGig.tasks && selectedGig.tasks.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 8, textTransform: "uppercase" }}>Tasks</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedGig.tasks.slice(0, 3).map(task => (
                    <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: task.done ? "#666" : "#ccc" }}>
                      <Icon name={task.done ? "check" : "events"} size={14} />
                      <span style={{ textDecoration: task.done ? "line-through" : "none" }}>{task.text}</span>
                    </div>
                  ))}
                  {selectedGig.tasks.length > 3 && (
                    <div style={{ fontSize: 12, color: "#6366f1" }}>+{selectedGig.tasks.length - 3} more tasks</div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setSelectedGig(null)}>Close</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: INQUIRY MANAGEMENT
// ═══════════════════════════════════════════════════════

const InquiryManagement = ({ inquiries, setInquiries, onConvertToContract }) => {
  const [showNew, setShowNew] = useState(false);
  const [newInq, setNewInq] = useState({ name: "", contact: "", email: "", phone: "", phase: "new", grade: "B", date: "", value: 0, notes: "", nextSteps: "" });
  const [selectedInq, setSelectedInq] = useState(null);
  const [showArchive, setShowArchive] = useState(false);

  const addInquiry = () => {
    setInquiries(prev => [...prev, { ...newInq, id: generateId() }]);
    setNewInq({ name: "", contact: "", email: "", phone: "", phase: "new", grade: "B", date: "", value: 0, notes: "", nextSteps: "" });
    setShowNew(false);
  };

  const updatePhase = (id, phase) => {
    setInquiries(prev => prev.map(inq => inq.id === id ? { ...inq, phase } : inq));
  };

  // Separate active and released inquiries
  const activeInquiries = inquiries.filter(i => i.phase !== "released");
  const releasedInquiries = inquiries.filter(i => i.phase === "released");
  const activePhases = INQUIRY_PHASES.filter(p => p.id !== "released");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Inquiry Management</h1>
          <p style={{ color: "#888", fontSize: 14 }}>Track leads through your pipeline</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {releasedInquiries.length > 0 && (
            <Btn variant={showArchive ? "secondary" : "ghost"} onClick={() => setShowArchive(!showArchive)}>
              {showArchive ? "Hide" : "Show"} Archive ({releasedInquiries.length})
            </Btn>
          )}
          <Btn icon="plus" onClick={() => setShowNew(true)}>New Inquiry</Btn>
        </div>
      </div>

      {/* Pipeline view */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, marginBottom: 20 }}>
        {activePhases.map(phase => {
          const items = activeInquiries.filter(i => i.phase === phase.id);
          return (
            <div key={phase.id} style={{ minWidth: 260, flex: 1, background: "#1a1d23", borderRadius: 14, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: phase.color }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0" }}>{phase.label}</span>
                </div>
                <Badge color={phase.color}>{items.length}</Badge>
              </div>
              <div style={{ padding: 8, minHeight: 100 }}>
                {items.map(inq => (
                  <div key={inq.id} onClick={() => setSelectedInq(inq)}
                    style={{ padding: 12, marginBottom: 8, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = phase.color + "44"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0" }}>{inq.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: LEAD_GRADES.find(g => g.grade === inq.grade)?.color, background: LEAD_GRADES.find(g => g.grade === inq.grade)?.color + "18", padding: "1px 6px", borderRadius: 4 }}>
                        {inq.grade}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>{inq.contact}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{formatDate(inq.date)} · {formatCurrency(inq.value)}</div>
                    {inq.nextSteps && <div style={{ fontSize: 11, color: "#6366f1", marginTop: 6 }}>→ {inq.nextSteps}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Archive Section */}
      {showArchive && releasedInquiries.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#888" }}>Released / Archive ({releasedInquiries.length})</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {releasedInquiries.map(inq => (
              <div key={inq.id} onClick={() => setSelectedInq(inq)}
                style={{ padding: 16, borderRadius: 12, background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)", cursor: "pointer", opacity: 0.8 }}
                onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                onMouseLeave={e => e.currentTarget.style.opacity = "0.8"}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#888" }}>{inq.name}</span>
                  <Badge color="#ef4444">Released</Badge>
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>{inq.contact}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{formatDate(inq.date)} · {formatCurrency(inq.value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Inquiry Modal */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="New Inquiry" width="550px">
        <Input label="Event / Project Name" value={newInq.name} onChange={v => setNewInq(p => ({ ...p, name: v }))} placeholder="Johnson Wedding" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Contact Name" value={newInq.contact} onChange={v => setNewInq(p => ({ ...p, contact: v }))} placeholder="Sarah Johnson" />
          <Input label="Email" value={newInq.email} onChange={v => setNewInq(p => ({ ...p, email: v }))} placeholder="sarah@email.com" />
          <Input label="Phone" value={newInq.phone} onChange={v => setNewInq(p => ({ ...p, phone: v }))} placeholder="555-0101" />
          <Input label="Event Date" type="date" value={newInq.date} onChange={v => setNewInq(p => ({ ...p, date: v }))} />
          <Input label="Estimated Value ($)" type="number" value={newInq.value} onChange={v => setNewInq(p => ({ ...p, value: Number(v) }))} />
          <Select label="Lead Grade" value={newInq.grade} onChange={v => setNewInq(p => ({ ...p, grade: v }))}
            options={LEAD_GRADES.map(g => ({ value: g.grade, label: `${g.grade} — ${g.label}` }))} />
        </div>
        <TextArea label="Notes" value={newInq.notes} onChange={v => setNewInq(p => ({ ...p, notes: v }))} placeholder="Details about the inquiry..." />
        <Input label="Next Steps" value={newInq.nextSteps} onChange={v => setNewInq(p => ({ ...p, nextSteps: v }))} placeholder="Send pricing guide" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Btn variant="secondary" onClick={() => setShowNew(false)}>Cancel</Btn>
          <Btn onClick={addInquiry}>Add Inquiry</Btn>
        </div>
      </Modal>

      {/* View/Edit Inquiry Modal */}
      <Modal isOpen={selectedInq !== null} onClose={() => setSelectedInq(null)} title={selectedInq?.name || ""} width="550px">
        {selectedInq && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div><span style={{ fontSize: 12, color: "#888" }}>Contact</span><div style={{ color: "#f0f0f0" }}>{selectedInq.contact}</div></div>
              <div><span style={{ fontSize: 12, color: "#888" }}>Email</span><div style={{ color: "#f0f0f0" }}>{selectedInq.email}</div></div>
              <div><span style={{ fontSize: 12, color: "#888" }}>Phone</span><div style={{ color: "#f0f0f0" }}>{selectedInq.phone}</div></div>
              <div><span style={{ fontSize: 12, color: "#888" }}>Date</span><div style={{ color: "#f0f0f0" }}>{formatDate(selectedInq.date)}</div></div>
              <div><span style={{ fontSize: 12, color: "#888" }}>Value</span><div style={{ color: "#f0f0f0" }}>{formatCurrency(selectedInq.value)}</div></div>
              <div><span style={{ fontSize: 12, color: "#888" }}>Grade</span><div>
                <Badge color={LEAD_GRADES.find(g => g.grade === selectedInq.grade)?.color}>
                  {selectedInq.grade} — {LEAD_GRADES.find(g => g.grade === selectedInq.grade)?.label}
                </Badge>
              </div></div>
            </div>
            {selectedInq.notes && <div style={{ marginBottom: 16 }}><span style={{ fontSize: 12, color: "#888" }}>Notes</span><div style={{ color: "#ccc", fontSize: 14 }}>{selectedInq.notes}</div></div>}
            {selectedInq.nextSteps && <div style={{ marginBottom: 20 }}><span style={{ fontSize: 12, color: "#888" }}>Next Steps</span><div style={{ color: "#6366f1", fontSize: 14 }}>→ {selectedInq.nextSteps}</div></div>}

            <div style={{ fontSize: 12, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Move to Phase</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {INQUIRY_PHASES.map(p => (
                <button key={p.id} onClick={() => { updatePhase(selectedInq.id, p.id); setSelectedInq({ ...selectedInq, phase: p.id }); }}
                  style={{ padding: "6px 12px", borderRadius: 6, border: selectedInq.phase === p.id ? `1px solid ${p.color}` : "1px solid rgba(255,255,255,0.08)", background: selectedInq.phase === p.id ? p.color + "22" : "transparent", color: selectedInq.phase === p.id ? p.color : "#888", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {selectedInq.phase === "confirmed" && (
                <Btn variant="success" onClick={() => { onConvertToContract(selectedInq); setSelectedInq(null); }}>
                  Convert to Contract →
                </Btn>
              )}
              {selectedInq.phase !== "released" && (
                <Btn variant="danger" onClick={() => {
                  if (window.confirm(`Release "${selectedInq.name}"? This will mark the inquiry as lost/passed.`)) {
                    updatePhase(selectedInq.id, "released");
                    setSelectedInq(null);
                  }
                }}>
                  Release
                </Btn>
              )}
              {selectedInq.phase === "released" && (
                <Btn variant="secondary" onClick={() => {
                  if (window.confirm(`Permanently delete "${selectedInq.name}"?`)) {
                    setInquiries(prev => prev.filter(i => i.id !== selectedInq.id));
                    setSelectedInq(null);
                  }
                }} icon="trash">
                  Delete
                </Btn>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: CONTRACTING & INVOICING
// ═══════════════════════════════════════════════════════

const Contracting = ({ contracts, setContracts, invoices, setInvoices }) => {
  const [showNewContract, setShowNewContract] = useState(false);
  const [showInvoiceOnly, setShowInvoiceOnly] = useState(false);
  const [showImportContract, setShowImportContract] = useState(false);
  const [newContract, setNewContract] = useState({ client: "", email: "", eventName: "", eventDate: "", value: 0, terms: "" });
  const [importFile, setImportFile] = useState(null);
  const [importFilePreview, setImportFilePreview] = useState(null);
  const [assignToContract, setAssignToContract] = useState("");
  const contractFileRef = useRef(null);

  const handleContractFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large (max 10MB)");
      return;
    }
    setImportFile(file);
    // Create preview for images/PDFs
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (evt) => setImportFilePreview(evt.target.result);
      reader.readAsDataURL(file);
    } else {
      setImportFilePreview(null);
    }
  };

  const handleImportContract = () => {
    if (!importFile || !assignToContract) return;
    // Update the contract with the file reference
    setContracts(prev => prev.map(c => c.id === assignToContract ? {
      ...c,
      contractFile: importFile.name,
      contractFileData: importFilePreview, // Store base64 for images
      hasContractFile: true
    } : c));
    setShowImportContract(false);
    setImportFile(null);
    setImportFilePreview(null);
    setAssignToContract("");
    alert("Contract file attached successfully!");
  };

  const createContract = () => {
    const contract = { id: generateId(), ...newContract, status: "active", createdDate: new Date().toISOString().split("T")[0] };
    setContracts(prev => [...prev, contract]);
    // Auto-create invoice
    const inv = {
      id: generateId(),
      number: `INV-${String(invoices.length + 1).padStart(3, "0")}`,
      client: newContract.client,
      email: newContract.email,
      items: [{ desc: `${newContract.eventName} — Full Service`, qty: 1, rate: newContract.value }],
      status: "sent",
      date: new Date().toISOString().split("T")[0],
      dueDate: newContract.eventDate,
      paidDate: null,
    };
    setInvoices(prev => [...prev, inv]);
    setNewContract({ client: "", email: "", eventName: "", eventDate: "", value: 0, terms: "" });
    setShowNewContract(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Contracting & Invoicing</h1>
          <p style={{ color: "#888", fontSize: 14 }}>Manage contracts and auto-generate invoices</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn icon="plus" onClick={() => setShowNewContract(true)}>New Contract + Invoice</Btn>
          <Btn variant="secondary" icon="download" onClick={() => setShowImportContract(true)}>Import Contract</Btn>
          <Btn variant="secondary" icon="invoice" onClick={() => setShowInvoiceOnly(true)}>Invoice Only</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <StatCard label="Active Contracts" value={contracts.filter(c => c.status === "active").length} accent="#6366f1" icon="contract" />
        <StatCard label="With Files" value={contracts.filter(c => c.hasContractFile).length} accent="#8b5cf6" icon="contract" />
        <StatCard label="Total Contract Value" value={formatCurrency(contracts.reduce((s, c) => s + c.value, 0))} accent="#10b981" icon="dollar" />
      </div>

      {contracts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#666" }}>
          <Icon name="contract" size={48} />
          <p style={{ marginTop: 16, fontSize: 14 }}>No contracts yet. Create one from an inquiry or manually.</p>
        </div>
      ) : (
        <Table
          columns={[
            { key: "eventName", label: "Event" },
            { key: "client", label: "Client" },
            { key: "eventDate", label: "Date", render: r => formatDate(r.eventDate) },
            { key: "value", label: "Value", align: "right", render: r => <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{formatCurrency(r.value)}</span> },
            { key: "file", label: "File", align: "center", render: r => r.hasContractFile
              ? <span style={{ color: "#10b981" }} title={r.contractFile}><Icon name="check" size={16} /></span>
              : <span style={{ color: "#666" }}>—</span>
            },
            { key: "status", label: "Status", render: r => <Badge color={r.status === "active" ? "#10b981" : "#888"}>{r.status}</Badge> },
            { key: "createdDate", label: "Created", render: r => formatDate(r.createdDate) },
          ]}
          data={contracts}
        />
      )}

      <Modal isOpen={showNewContract} onClose={() => setShowNewContract(false)} title="New Contract + Invoice" width="550px">
        <Input label="Client Name" value={newContract.client} onChange={v => setNewContract(p => ({ ...p, client: v }))} />
        <Input label="Client Email" value={newContract.email} onChange={v => setNewContract(p => ({ ...p, email: v }))} />
        <Input label="Event Name" value={newContract.eventName} onChange={v => setNewContract(p => ({ ...p, eventName: v }))} />
        <Input label="Event Date" type="date" value={newContract.eventDate} onChange={v => setNewContract(p => ({ ...p, eventDate: v }))} />
        <Input label="Contract Value ($)" type="number" value={newContract.value} onChange={v => setNewContract(p => ({ ...p, value: Number(v) }))} />
        <TextArea label="Terms & Notes" value={newContract.terms} onChange={v => setNewContract(p => ({ ...p, terms: v }))} placeholder="Contract terms, scope of work, payment schedule..." rows={4} />
        <p style={{ fontSize: 12, color: "#6366f1", marginBottom: 16 }}>An invoice will be automatically generated from this contract.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={() => setShowNewContract(false)}>Cancel</Btn>
          <Btn variant="success" onClick={createContract}>Create Contract & Invoice</Btn>
        </div>
      </Modal>

      <Modal isOpen={showInvoiceOnly} onClose={() => setShowInvoiceOnly(false)} title="Quick Invoice (No Contract)" width="500px">
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>Create a standalone invoice without a contract.</p>
        <Input label="Client" value="" onChange={() => {}} placeholder="Client name" />
        <Input label="Email" value="" onChange={() => {}} placeholder="billing@client.com" />
        <Input label="Amount" type="number" value="" onChange={() => {}} placeholder="0.00" />
        <Input label="Description" value="" onChange={() => {}} placeholder="Service description" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={() => setShowInvoiceOnly(false)}>Cancel</Btn>
          <Btn>Create Invoice</Btn>
        </div>
      </Modal>

      {/* Import Contract Modal */}
      <Modal isOpen={showImportContract} onClose={() => { setShowImportContract(false); setImportFile(null); setImportFilePreview(null); setAssignToContract(""); }} title="Import Contract File" width="550px">
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>Upload a signed contract (PDF or image) and assign it to a gig.</p>

        {/* File Upload */}
        <div style={{ marginBottom: 20 }}>
          <input ref={contractFileRef} type="file" accept=".pdf,image/*" onChange={handleContractFileUpload} style={{ display: "none" }} />
          {!importFile ? (
            <div onClick={() => contractFileRef.current?.click()}
              style={{ border: "2px dashed rgba(255,255,255,0.1)", borderRadius: 12, padding: 40, textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}>
              <Icon name="download" size={32} />
              <p style={{ color: "#888", marginTop: 12, marginBottom: 4 }}>Click to upload contract file</p>
              <p style={{ color: "#666", fontSize: 12 }}>PDF, JPG, PNG (max 10MB)</p>
            </div>
          ) : (
            <div style={{ background: "rgba(99,102,241,0.06)", borderRadius: 12, padding: 16, border: "1px solid rgba(99,102,241,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Icon name="contract" size={24} />
                  <div>
                    <div style={{ fontSize: 14, color: "#f0f0f0", fontWeight: 500 }}>{importFile.name}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{(importFile.size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
                <Btn variant="ghost" icon="x" onClick={() => { setImportFile(null); setImportFilePreview(null); }} />
              </div>
              {importFilePreview && (
                <img src={importFilePreview} alt="Contract preview" style={{ marginTop: 12, maxWidth: "100%", maxHeight: 200, borderRadius: 8 }} />
              )}
            </div>
          )}
        </div>

        {/* Assign to Contract */}
        <Select label="Assign to Gig / Contract" value={assignToContract} onChange={setAssignToContract}
          options={[
            { value: "", label: "Select a gig..." },
            ...contracts.filter(c => !c.hasContractFile).map(c => ({ value: c.id, label: `${c.eventName} — ${c.client}` }))
          ]} />

        {contracts.filter(c => !c.hasContractFile).length === 0 && (
          <p style={{ color: "#f59e0b", fontSize: 12, marginTop: -8, marginBottom: 16 }}>
            All existing contracts already have files attached. Create a new contract first.
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn variant="secondary" onClick={() => { setShowImportContract(false); setImportFile(null); setImportFilePreview(null); setAssignToContract(""); }}>Cancel</Btn>
          <Btn onClick={handleImportContract} disabled={!importFile || !assignToContract}>Attach Contract</Btn>
        </div>
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: CALENDAR
// ═══════════════════════════════════════════════════════

const CalendarView = ({ events }) => {
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const monthName = new Date(viewYear, viewMonth).toLocaleString("default", { month: "long", year: "numeric" });

  const getEventsForDay = (day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter(e => e.date === dateStr);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Calendar</h1>
          <p style={{ color: "#888", fontSize: 14 }}>Contracted events synced automatically</p>
        </div>
        <Btn variant="secondary" icon="sync">Sync to Google Calendar</Btn>
      </div>

      <div style={{ background: "#1a1d23", borderRadius: 14, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }}
            style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 18, transform: "rotate(180deg)", fontFamily: "inherit" }}>
            <Icon name="chevron" size={20} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0" }}>{monthName}</span>
          <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }}
            style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}>
            <Icon name="chevron" size={20} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} style={{ padding: "10px 8px", textAlign: "center", fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {d}
            </div>
          ))}
          {blanks.map(b => <div key={`b${b}`} style={{ padding: 8, minHeight: 80, borderBottom: "1px solid rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.03)" }} />)}
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const isToday = day === new Date().getDate() && viewMonth === new Date().getMonth() && viewYear === new Date().getFullYear();
            return (
              <div key={day} style={{ padding: 8, minHeight: 80, borderBottom: "1px solid rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.03)", background: isToday ? "rgba(99,102,241,0.06)" : "transparent" }}>
                <div style={{ fontSize: 12, color: isToday ? "#6366f1" : "#888", fontWeight: isToday ? 700 : 400, marginBottom: 4 }}>{day}</div>
                {dayEvents.map(ev => (
                  <div key={ev.id} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#6366f122", color: "#6366f1", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ev.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 12 }}>Upcoming Events</h3>
        {events.sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
          <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px", background: "#1a1d23", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 8 }}>
            <div style={{ width: 48, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#6366f1", fontFamily: "monospace" }}>{new Date(ev.date + "T00:00:00").getDate()}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{new Date(ev.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "#f0f0f0", fontWeight: 500 }}>{ev.name}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{ev.venue} · {ev.guests} guests · {ev.time}</div>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: "#10b981" }}>{formatCurrency(ev.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: EVENT TASKS & UPDATES
// ═══════════════════════════════════════════════════════

const EventTasks = ({ events, setEvents }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [newTask, setNewTask] = useState("");

  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));

  const addTask = (eventId) => {
    if (!newTask.trim()) return;
    setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, tasks: [...ev.tasks, { id: generateId(), text: newTask, done: false }] } : ev));
    setNewTask("");
  };

  const toggleTask = (eventId, taskId) => {
    setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, tasks: ev.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) } : ev));
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Event Tasks & Updates</h1>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>Preparation tracking for upcoming events, soonest first</p>

      {sortedEvents.map(ev => {
        const completedTasks = ev.tasks.filter(t => t.done).length;
        const totalTasks = ev.tasks.length;
        const pct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        const isExpanded = selectedEvent === ev.id;

        return (
          <div key={ev.id} style={{ background: "#1a1d23", borderRadius: 14, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 12, overflow: "hidden" }}>
            {/* Event Header Bar */}
            <div onClick={() => setSelectedEvent(isExpanded ? null : ev.id)}
              style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 52, textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#6366f1", fontFamily: "monospace" }}>{new Date(ev.date + "T00:00:00").getDate()}</div>
                <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase" }}>{new Date(ev.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>{ev.name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{ev.client} · {ev.venue} · {ev.guests} guests</div>
              </div>
              <div style={{ width: 120, flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginBottom: 4 }}>
                  <span>Tasks</span><span>{completedTasks}/{totalTasks}</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#10b981" : "#6366f1", borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              </div>
              <div style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", color: "#888" }}>
                <Icon name="chevron" size={16} />
              </div>
            </div>

            {/* Expanded Tasks */}
            {isExpanded && (
              <div style={{ padding: "0 20px 20px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ paddingTop: 16 }}>
                  {ev.tasks.map(task => (
                    <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <div onClick={() => toggleTask(ev.id, task.id)}
                        style={{ width: 20, height: 20, borderRadius: 5, border: task.done ? "none" : "2px solid rgba(255,255,255,0.15)", background: task.done ? "#10b981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                        {task.done && <Icon name="check" size={12} />}
                      </div>
                      <span style={{ fontSize: 13, color: task.done ? "#666" : "#ccc", textDecoration: task.done ? "line-through" : "none" }}>{task.text}</span>
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <input value={newTask} onChange={e => setNewTask(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addTask(ev.id)}
                      placeholder="Add a new task..."
                      style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "#f0f0f0", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                    <Btn onClick={() => addTask(ev.id)} icon="plus">Add</Btn>
                  </div>
                </div>

                {/* Email Communications */}
                {ev.emails && ev.emails.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Email Communications</div>
                    {ev.emails.map((email, i) => (
                      <div key={i} style={{ padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 500 }}>{email.from}</span>
                          <span style={{ fontSize: 11, color: "#666" }}>{formatDate(email.date)}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#f0f0f0", fontWeight: 500, marginBottom: 2 }}>{email.subject}</div>
                        <div style={{ fontSize: 12, color: "#888" }}>{email.snippet}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: EMAIL COMMUNICATION SORTING
// ═══════════════════════════════════════════════════════

const EmailComms = ({ events }) => {
  const allEmails = events.flatMap(ev => (ev.emails || []).map(em => ({ ...em, eventName: ev.name, eventId: ev.id }))).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Email Communication</h1>
          <p style={{ color: "#888", fontSize: 14 }}>Gmail-synced correspondence sorted by event</p>
        </div>
        <Btn variant="secondary" icon="sync">Sync Gmail</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
        {/* Event sidebar */}
        <div style={{ background: "#1a1d23", borderRadius: 14, border: "1px solid rgba(255,255,255,0.05)", padding: 12 }}>
          <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>Events</div>
          <div style={{ padding: "4px 8px 8px", fontSize: 12, color: "#6366f1", fontWeight: 500, cursor: "pointer", borderRadius: 6, background: "rgba(99,102,241,0.08)", margin: "8px 0" }}>All Events</div>
          {events.map(ev => (
            <div key={ev.id} style={{ padding: "8px", fontSize: 13, color: "#ccc", cursor: "pointer", borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {ev.name}
              <span style={{ fontSize: 11, color: "#666", marginLeft: 6 }}>({(ev.emails || []).length})</span>
            </div>
          ))}
        </div>

        {/* Email list */}
        <div>
          {allEmails.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#666" }}>
              <Icon name="email" size={48} />
              <p style={{ marginTop: 16, fontSize: 14 }}>No emails synced yet. Connect Gmail to get started.</p>
            </div>
          ) : allEmails.map((email, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: 16, background: "#1a1d23", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="email" size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 13, color: "#f0f0f0", fontWeight: 500 }}>{email.subject}</span>
                  <span style={{ fontSize: 11, color: "#666" }}>{formatDate(email.date)}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6366f1", marginBottom: 4 }}>{email.from} → {email.eventName}</div>
                <div style={{ fontSize: 13, color: "#888" }}>{email.snippet}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SECTION: ACCEPT PAYMENTS
// ═══════════════════════════════════════════════════════

const Payments = ({ invoices, transactions }) => {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  // Match transactions to invoices for reconciliation
  const incomeTransactions = transactions.filter(t => t.amount > 0);
  const sentInvoices = invoices.filter(i => i.status === "sent");

  const suggestedMatches = sentInvoices.map(inv => {
    const invTotal = inv.items.reduce((a, it) => a + it.qty * it.rate, 0);
    const match = incomeTransactions.find(t => Math.abs(t.amount - invTotal) < 1);
    return { invoice: inv, match, total: invTotal };
  }).filter(m => m.match);

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Accept Payments</h1>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>Process payments and reconcile with invoices</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Payment Terminal */}
        <div style={{ background: "#1a1d23", borderRadius: 14, border: "1px solid rgba(255,255,255,0.05)", padding: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="payment" size={20} /> Payment Terminal
          </h3>
          <Input label="Amount" type="number" value={paymentAmount} onChange={setPaymentAmount} placeholder="0.00" />
          <Input label="Card Number" value={cardNumber} onChange={v => setCardNumber(v.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").trim())} placeholder="4242 4242 4242 4242" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Expiry" value={expiry} onChange={setExpiry} placeholder="MM/YY" />
            <Input label="CVV" value={cvv} onChange={setCvv} placeholder="123" />
          </div>

          <Select label="Link to Invoice" value="" onChange={() => {}}
            options={[{ value: "", label: "Select an invoice..." }, ...invoices.filter(i => i.status !== "paid").map(i => ({ value: i.id, label: `${i.number} — ${i.client} — ${formatCurrency(i.items.reduce((a, it) => a + it.qty * it.rate, 0))}` }))]} />

          <Btn variant="success" style={{ width: "100%", padding: "12px", fontSize: 15, marginTop: 8 }}>
            {paymentAmount ? `Charge ${formatCurrency(Number(paymentAmount))}` : "Process Payment"}
          </Btn>
          <p style={{ fontSize: 11, color: "#666", textAlign: "center", marginTop: 8 }}>Payments processed securely via Stripe</p>
        </div>

        {/* Reconciliation */}
        <div style={{ background: "#1a1d23", borderRadius: 14, border: "1px solid rgba(255,255,255,0.05)", padding: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="sync" size={20} /> Auto-Reconciliation
          </h3>
          <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Suggested matches between bank deposits and invoices:</p>

          {suggestedMatches.length > 0 ? suggestedMatches.map((m, i) => (
            <div key={i} style={{ padding: 14, borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.04)", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>Suggested Match</span>
                <Btn variant="success" style={{ fontSize: 11, padding: "4px 10px" }}>Confirm</Btn>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <div>
                  <div style={{ color: "#ccc" }}>{m.invoice.number} — {m.invoice.client}</div>
                  <div style={{ color: "#888", fontSize: 12 }}>Invoice: {formatCurrency(m.total)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#ccc" }}>{m.match.description}</div>
                  <div style={{ color: "#10b981", fontSize: 12, fontFamily: "monospace" }}>+{formatCurrency(m.match.amount)}</div>
                </div>
              </div>
            </div>
          )) : (
            <div style={{ textAlign: "center", padding: 24, color: "#666" }}>
              <p style={{ fontSize: 13 }}>No automatic matches found. Payments will be suggested as they arrive.</p>
            </div>
          )}

          <div style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", marginBottom: 12 }}>Manual Reconciliation</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Select label="Select Transaction" value="" onChange={() => {}}
                options={[{ value: "", label: "Choose deposit..." }, ...incomeTransactions.map(t => ({ value: t.id, label: `${t.description} — ${formatCurrency(t.amount)}` }))]} />
              <Select label="Match to Invoice" value="" onChange={() => {}}
                options={[{ value: "", label: "Choose invoice..." }, ...invoices.filter(i => i.status !== "paid").map(i => ({ value: i.id, label: `${i.number} — ${formatCurrency(i.items.reduce((a, it) => a + it.qty * it.rate, 0))}` }))]} />
            </div>
            <Btn variant="secondary" style={{ marginTop: 8 }}>Reconcile</Btn>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div style={{ marginTop: 24, background: "#1a1d23", borderRadius: 14, border: "1px solid rgba(255,255,255,0.05)", padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 16 }}>Recent Payments Received</h3>
        {incomeTransactions.map(t => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div>
              <div style={{ fontSize: 14, color: "#f0f0f0" }}>{t.description}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{formatDate(t.date)} · {t.account}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#10b981" }}>+{formatCurrency(t.amount)}</span>
              {t.reconciled ? <Badge color="#10b981">Reconciled</Badge> : <Badge color="#f59e0b">Unmatched</Badge>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "aiagent", label: "AI Agent", icon: "ai" },
  { id: "proposals", label: "Proposals", icon: "document" },
  { id: "upcoming", label: "Upcoming Gigs", icon: "star" },
  { id: "tax", label: "S Corp Tax", icon: "tax" },
  { id: "banking", label: "Banking", icon: "bank" },
  { id: "expenses", label: "Expenses", icon: "receipt" },
  { id: "invoicing", label: "Invoicing", icon: "invoice" },
  { id: "inquiries", label: "Inquiries", icon: "inquiry" },
  { id: "contracts", label: "Contracts", icon: "contract" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "events", label: "Event Tasks", icon: "events" },
  { id: "email", label: "Email", icon: "email" },
  { id: "payments", label: "Payments", icon: "payment" },
];

export default function App() {
  const [activeView, setActiveView] = useState(() => localStorage.getItem("sg_activeView") || "dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load all data from Supabase (with localStorage fallback)
  const {
    transactions, setTransactions,
    invoices, setInvoices,
    inquiries, setInquiries,
    contracts, setContracts,
    events, setEvents,
    proposals, setProposals,
    expenses, setExpenses,
    creditCards, setCreditCards,
    bankAccounts, setBankAccounts,
    budgets, setBudgets,
    categoryRules, setCategoryRules,
    customCategories, setCustomCategories,
    loading: dataLoading,
    isSupabaseConfigured: usingSupabase
  } = useSuiteGigData();

  const expenseCategories = [...DEFAULT_EXPENSE_CATEGORIES.filter(c => c !== "Unknown"), ...customCategories, "Unknown"];

  useEffect(() => { localStorage.setItem("sg_activeView", activeView); }, [activeView]);

  const handleConvertToContract = (inquiry) => {
    const contract = {
      id: generateId(),
      client: inquiry.contact,
      email: inquiry.email,
      eventName: inquiry.name,
      eventDate: inquiry.date,
      value: inquiry.value,
      terms: inquiry.notes,
      status: "active",
      createdDate: new Date().toISOString().split("T")[0],
    };
    setContracts(prev => [...prev, contract]);

    // Create invoice
    const inv = {
      id: generateId(),
      number: `INV-${String(invoices.length + 1).padStart(3, "0")}`,
      client: inquiry.contact,
      email: inquiry.email,
      items: [{ desc: `${inquiry.name} — Full Service`, qty: 1, rate: inquiry.value }],
      status: "sent",
      date: new Date().toISOString().split("T")[0],
      dueDate: inquiry.date,
      paidDate: null,
    };
    setInvoices(prev => [...prev, inv]);

    // Create calendar event
    const event = {
      id: generateId(),
      name: inquiry.name,
      client: inquiry.contact,
      date: inquiry.date,
      time: "12:00",
      venue: "TBD",
      guests: 0,
      value: inquiry.value,
      email: inquiry.email,
      tasks: [
        { id: generateId(), text: "Send welcome packet to client", done: false },
        { id: generateId(), text: "Schedule planning meeting", done: false },
        { id: generateId(), text: "Create event timeline", done: false },
      ],
      emails: [],
    };
    setEvents(prev => [...prev, event]);

    // Remove from inquiries
    setInquiries(prev => prev.filter(i => i.id !== inquiry.id));
    setActiveView("contracts");
  };

  const handleSendToProposals = (proposal) => {
    setProposals(prev => [proposal, ...prev]);
    setActiveView("proposals");
  };

  const renderView = () => {
    switch (activeView) {
      case "dashboard": return <Dashboard transactions={transactions} invoices={invoices} inquiries={inquiries} events={events} />;
      case "aiagent": return <AIAgent inquiries={inquiries} setInquiries={setInquiries} onSendToProposals={handleSendToProposals} />;
      case "proposals": return <ProposalEditor proposals={proposals} setProposals={setProposals} />;
      case "upcoming": return <UpcomingGigs events={events} contracts={contracts} invoices={invoices} />;
      case "tax": return <TaxManagement transactions={transactions} />;
      case "banking": return <Banking transactions={transactions} setTransactions={setTransactions} bankAccounts={bankAccounts} setBankAccounts={setBankAccounts} expenseCategories={expenseCategories} />;
      case "expenses": return <Expenses expenses={expenses} setExpenses={setExpenses} creditCards={creditCards} setCreditCards={setCreditCards} budgets={budgets} setBudgets={setBudgets} categoryRules={categoryRules} setCategoryRules={setCategoryRules} expenseCategories={expenseCategories} customCategories={customCategories} setCustomCategories={setCustomCategories} />;
      case "invoicing": return <Invoicing invoices={invoices} setInvoices={setInvoices} />;
      case "inquiries": return <InquiryManagement inquiries={inquiries} setInquiries={setInquiries} onConvertToContract={handleConvertToContract} />;
      case "contracts": return <Contracting contracts={contracts} setContracts={setContracts} invoices={invoices} setInvoices={setInvoices} />;
      case "calendar": return <CalendarView events={events} />;
      case "events": return <EventTasks events={events} setEvents={setEvents} />;
      case "email": return <EmailComms events={events} />;
      case "payments": return <Payments invoices={invoices} transactions={transactions} />;
      default: return <Dashboard transactions={transactions} invoices={invoices} inquiries={inquiries} events={events} />;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#111318", color: "#f0f0f0", fontFamily: "'DM Sans', -apple-system, sans-serif", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <div style={{ width: sidebarCollapsed ? 64 : 220, background: "#14161b", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", transition: "width 0.2s", flexShrink: 0, overflow: "hidden" }}>
        <div onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{ padding: sidebarCollapsed ? "20px 16px" : "20px 20px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            S
          </div>
          {!sidebarCollapsed && <span style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0", whiteSpace: "nowrap" }}>SuiteGig</span>}
        </div>

        <nav style={{ flex: 1, padding: "8px", overflow: "auto" }}>
          {NAV_ITEMS.map(item => (
            <div key={item.id} onClick={() => setActiveView(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: sidebarCollapsed ? "10px 12px" : "10px 12px",
                marginBottom: 2, borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                background: activeView === item.id ? "rgba(99,102,241,0.12)" : "transparent",
                color: activeView === item.id ? "#6366f1" : "#888",
              }}
              onMouseEnter={e => { if (activeView !== item.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (activeView !== item.id) e.currentTarget.style.background = "transparent"; }}>
              <div style={{ flexShrink: 0 }}><Icon name={item.icon} size={18} /></div>
              {!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>{item.label}</span>}
            </div>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "#666" }}>
            <div>SuiteGig v1.0</div>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: usingSupabase ? "#10b981" : "#f59e0b" }}></span>
              {usingSupabase ? "Supabase" : "Local Storage"}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {dataLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", flexDirection: "column", gap: 16 }}>
              <div style={{ width: 40, height: 40, border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ color: "#888", fontSize: 14 }}>Loading data{usingSupabase ? " from Supabase" : ""}...</div>
            </div>
          ) : renderView()}
        </div>
      </div>
    </div>
  );
}
