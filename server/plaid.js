/**
 * Plaid Integration Server for SuiteGig
 *
 * SETUP:
 * 1. Sign up at https://dashboard.plaid.com/signup (sandbox is free)
 * 2. Get your credentials from the Plaid Dashboard → Keys
 * 3. Set the environment variables below (or use a .env file)
 * 4. Install dependencies: npm install express cors plaid dotenv
 * 5. Run: node server/plaid.js
 * 6. The server runs on port 3005 — the Vite dev server proxies /api to it
 *
 * ENVIRONMENT VARIABLES:
 *   PLAID_CLIENT_ID   — Your Plaid client ID
 *   PLAID_SECRET      — Your Plaid secret (sandbox or development)
 *   PLAID_ENV         — "sandbox" (testing) or "development" (real banks, limited)
 */

const express = require("express");
const cors = require("cors");
const { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } = require("plaid");

// Load .env file if present
try { require("dotenv").config(); } catch {}

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || "";
const PLAID_SECRET = process.env.PLAID_SECRET || "";
const PLAID_ENV = process.env.PLAID_ENV || "sandbox";

if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  console.error("\n❌ Missing Plaid credentials.");
  console.error("   Set PLAID_CLIENT_ID and PLAID_SECRET environment variables.");
  console.error("   Get them at: https://dashboard.plaid.com/team/keys\n");
  process.exit(1);
}

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
      "PLAID-SECRET": PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);
const app = express();
app.use(cors());
app.use(express.json());

// Health check — frontend uses this to detect if Plaid is available
app.get("/api/plaid/status", (req, res) => {
  res.json({ status: "ok", env: PLAID_ENV });
});

// Create a link token for Plaid Link UI
app.post("/api/plaid/create-link-token", async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "suitegig-user" },
      client_name: "SuiteGig",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("Error creating link token:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to create link token" });
  }
});

// Exchange public token for access token
app.post("/api/plaid/exchange-token", async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    res.json({
      access_token: response.data.access_token,
      item_id: response.data.item_id,
    });
  } catch (err) {
    console.error("Error exchanging token:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to exchange token" });
  }
});

// Fetch transactions
app.post("/api/plaid/transactions", async (req, res) => {
  try {
    const { access_token } = req.body;
    // Get last 30 days of transactions
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: startDate,
      end_date: endDate,
      options: { count: 100, offset: 0 },
    });

    res.json({
      transactions: response.data.transactions,
      accounts: response.data.accounts,
      total: response.data.total_transactions,
    });
  } catch (err) {
    console.error("Error fetching transactions:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

const PORT = process.env.PLAID_PORT || 3005;
app.listen(PORT, () => {
  console.log(`\n✅ Plaid server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${PLAID_ENV}`);
  console.log(`   Endpoints:`);
  console.log(`     GET  /api/plaid/status`);
  console.log(`     POST /api/plaid/create-link-token`);
  console.log(`     POST /api/plaid/exchange-token`);
  console.log(`     POST /api/plaid/transactions\n`);
});
