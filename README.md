# CorpSuite — S Corp Business Management Suite

A comprehensive business management web application for S Corp operations.

## Modules

- **Dashboard** — Business overview with stats, alerts, and expense breakdown
- **S Corp Tax Management** — Form 941 templates, state forms, quarterly/annual checklists, employment filings, tax prep packaging
- **Banking & Expenses** — Transaction tracking, auto-categorization, unknown expense alerts
- **Invoicing** — Create/send/track invoices with auto-incrementing numbers
- **Inquiry Management** — Kanban pipeline with lead grading and phase tracking
- **Contracting & Invoicing** — Auto-generate contracts and invoices from confirmed inquiries
- **Calendar** — Monthly calendar view with Google Calendar sync support
- **Event Tasks & Updates** — Task management per event with email correspondence
- **Email Communication** — Gmail-synced email sorting by event
- **Payments** — Credit card terminal with auto-reconciliation

## Quick Start

### Prerequisites

You need **Node.js** installed (version 18 or higher).

Download it from: https://nodejs.org

To check if you have it:

```bash
node --version
```

### Setup

1. Open a terminal and navigate to this folder:

```bash
cd corpsuite
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser to **http://localhost:3000** (it should open automatically).

### Build for Production

To create an optimized build for deployment:

```bash
npm run build
```

The output will be in the `dist/` folder, which you can deploy to any static hosting service (Vercel, Netlify, etc.).
