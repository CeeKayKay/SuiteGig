import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import _ from "lodash";

// ═══════════════════════════════════════════════════════
// CONSTANTS & DATA
// ═══════════════════════════════════════════════════════

const EXPENSE_CATEGORIES = [
  "Office Supplies", "Software & Tools", "Marketing", "Travel",
  "Meals & Entertainment", "Professional Services", "Insurance",
  "Rent & Utilities", "Equipment", "Payroll", "Taxes",
  "Vehicle", "Education & Training", "Subscriptions", "Unknown"
];

const INQUIRY_PHASES = [
  { id: "new", label: "New Lead", color: "#6366f1" },
  { id: "contacted", label: "Contacted", color: "#f59e0b" },
  { id: "proposal", label: "Proposal Sent", color: "#3b82f6" },
  { id: "negotiation", label: "Negotiation", color: "#8b5cf6" },
  { id: "confirmed", label: "Confirmed", color: "#10b981" },
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

const generateId = () => Math.random().toString(36).substr(2, 9);

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
      {options.map(o => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}
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
              {col.label}
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

const Banking = ({ transactions, setTransactions }) => {
  const [filter, setFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [editingTx, setEditingTx] = useState(null);

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

      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1, background: "#1a1d23", borderRadius: 10, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="bank" size={18} />
          </div>
          <div><div style={{ fontSize: 11, color: "#888" }}>Business Checking</div><div style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", fontFamily: "monospace" }}>$24,531.47</div></div>
          <Badge color="#10b981" style={{ marginLeft: "auto" }}>Connected</Badge>
        </div>
        <div style={{ flex: 1, background: "#1a1d23", borderRadius: 10, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="payment" size={18} />
          </div>
          <div><div style={{ fontSize: 11, color: "#888" }}>Chase Business CC</div><div style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", fontFamily: "monospace" }}>-$1,283.92</div></div>
          <Badge color="#10b981" style={{ marginLeft: "auto" }}>Connected</Badge>
        </div>
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

      <Modal isOpen={editingTx !== null} onClose={() => setEditingTx(null)} title="Categorize Transaction" width="400px">
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>Select a category for this transaction:</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {EXPENSE_CATEGORIES.filter(c => c !== "Unknown").map(cat => (
            <button key={cat} onClick={() => handleCategorize(editingTx, cat)}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#ccc", fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              {cat}
            </button>
          ))}
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
// SECTION: INQUIRY MANAGEMENT
// ═══════════════════════════════════════════════════════

const InquiryManagement = ({ inquiries, setInquiries, onConvertToContract }) => {
  const [showNew, setShowNew] = useState(false);
  const [newInq, setNewInq] = useState({ name: "", contact: "", email: "", phone: "", phase: "new", grade: "B", date: "", value: 0, notes: "", nextSteps: "" });
  const [selectedInq, setSelectedInq] = useState(null);

  const addInquiry = () => {
    setInquiries(prev => [...prev, { ...newInq, id: generateId() }]);
    setNewInq({ name: "", contact: "", email: "", phone: "", phase: "new", grade: "B", date: "", value: 0, notes: "", nextSteps: "" });
    setShowNew(false);
  };

  const updatePhase = (id, phase) => {
    setInquiries(prev => prev.map(inq => inq.id === id ? { ...inq, phase } : inq));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Inquiry Management</h1>
          <p style={{ color: "#888", fontSize: 14 }}>Track leads through your pipeline</p>
        </div>
        <Btn icon="plus" onClick={() => setShowNew(true)}>New Inquiry</Btn>
      </div>

      {/* Pipeline view */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, marginBottom: 20 }}>
        {INQUIRY_PHASES.map(phase => {
          const items = inquiries.filter(i => i.phase === phase.id);
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

            {selectedInq.phase === "confirmed" && (
              <Btn variant="success" onClick={() => { onConvertToContract(selectedInq); setSelectedInq(null); }}>
                Convert to Contract →
              </Btn>
            )}
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
  const [newContract, setNewContract] = useState({ client: "", email: "", eventName: "", eventDate: "", value: 0, terms: "" });

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
          <Btn variant="secondary" icon="invoice" onClick={() => setShowInvoiceOnly(true)}>Invoice Only</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <StatCard label="Active Contracts" value={contracts.filter(c => c.status === "active").length} accent="#6366f1" icon="contract" />
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
  { id: "tax", label: "S Corp Tax", icon: "tax" },
  { id: "banking", label: "Banking", icon: "bank" },
  { id: "invoicing", label: "Invoicing", icon: "invoice" },
  { id: "inquiries", label: "Inquiries", icon: "inquiry" },
  { id: "contracts", label: "Contracts", icon: "contract" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "events", label: "Event Tasks", icon: "events" },
  { id: "email", label: "Email", icon: "email" },
  { id: "payments", label: "Payments", icon: "payment" },
];

export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [transactions, setTransactions] = useState(sampleTransactions);
  const [invoices, setInvoices] = useState(sampleInvoices);
  const [inquiries, setInquiries] = useState(sampleInquiries);
  const [contracts, setContracts] = useState([]);
  const [events, setEvents] = useState(sampleEvents);

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

  const renderView = () => {
    switch (activeView) {
      case "dashboard": return <Dashboard transactions={transactions} invoices={invoices} inquiries={inquiries} events={events} />;
      case "tax": return <TaxManagement transactions={transactions} />;
      case "banking": return <Banking transactions={transactions} setTransactions={setTransactions} />;
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
          {!sidebarCollapsed && <span style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0", whiteSpace: "nowrap" }}>CorpSuite</span>}
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
            CorpSuite v1.0 · S Corp Mgmt
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {renderView()}
        </div>
      </div>
    </div>
  );
}
