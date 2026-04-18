# Ledgerly — Accounting Software (Zoho Books clone)

## Original Problem Statement
Build me an accounting software like Zoho Books.

## User Choices (locked in during kickoff)
- Modules: All (Invoices, Bills, Expenses, Customers, Vendors, Items, Chart of Accounts, Journal Entries, Banking, Reports)
- Auth: Simple JWT email/password (bcrypt, httpOnly cookies + Bearer)
- AI features: None for MVP
- Scope: Single currency (USD), single organization
- Design: Clean SaaS-style (light, professional)

## Architecture
- **Backend**: FastAPI + Motor (MongoDB async). Single `server.py`. UUID primary keys. All endpoints under `/api`. Startup seeds admin + 18 default chart-of-accounts.
- **Frontend**: React 19 + React Router v7 + Shadcn UI + Tailwind + Recharts + Phosphor icons. Auth state in AuthContext with access token in localStorage + Bearer header. Sidebar + top bar layout.
- **Design System**: Deep Forest Green (primary) + Warm Terracotta (accent) + Bone background. Cabinet Grotesk headings / IBM Plex Sans body / IBM Plex Mono for numbers.

## User Personas
- **Small-business owner**: needs invoices, bills, expenses, and month-end P&L at a glance.
- **Bookkeeper**: uses journal entries, chart of accounts, and reports for compliance.

## What's Implemented (2026-04-18)
- **Auth**: register, login, logout, `/me`; bcrypt + JWT access (12h) + refresh (7d) in httpOnly cookies, Bearer header fallback. Admin seeded on startup.
- **Contacts**: customers + vendors CRUD.
- **Items & Services**: CRUD with sale price, purchase price, tax rate.
- **Invoices**: auto-numbering (INV-00001), line items with tax, totals calculated server-side, statuses (draft/sent/paid/overdue), send + record-payment actions (payment auto-creates a bank deposit).
- **Bills**: auto-numbering (BILL-00001), payment auto-creates a bank withdrawal.
- **Expenses**: category, payment method, optional vendor; auto-creates bank withdrawal.
- **Chart of Accounts**: 18 default accounts seeded; full CRUD grouped by type.
- **Journal Entries**: double-entry with balanced debit/credit enforcement.
- **Banking**: manual deposits/withdrawals; live balance + inflow/outflow cards.
- **Reports**: Profit & Loss, Balance Sheet, Cash Flow.
- **Dashboard**: KPI cards (Receivables, Payables, Cash, Net Profit), 6-month cash-flow bar chart, invoice-status pie, recent invoices + expenses tables.

## Test Coverage (Iteration 1)
- Backend: 41/41 API tests passing (100%)
- Frontend: Login, dashboard, navigation, invoice creation, reports, logout — all PASS

## Backlog — Next Tasks
### P0 (next iteration)
- PDF generation + email send for invoices (via Resend or SendGrid)
- Invoice PDF preview + share link
- Multi-user roles within the organization (Admin/Accountant/Viewer)

### P1
- Recurring invoices + auto-send schedule
- Import CSV for bank transactions + reconciliation matching
- Inventory tracking for goods (stock on hand, COGS)
- Tax summary report
- Dashboard date-range filters

### P2
- Multi-currency + exchange-rate conversion
- Multi-organization switching
- AI-powered expense categorization (Emergent LLM key)
- Natural-language financial query
- Stripe payment links on invoices
- Mobile-responsive refinements
