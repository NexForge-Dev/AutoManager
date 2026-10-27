# 💎 AutoManager

Management SaaS for **Brazilian micro-businesses** (sweets, costume jewelry, semi-fine jewelry,
cosmetics, clothing, stationery, handicrafts and any small shop). Inventory, one-tap sales,
automatic reseller commissions, finances (receivables/payables), a public storefront with chat
and real-profit reports. Mobile-first PWA with **cloud data (Supabase)**, isolated per store
via RLS. Full system documentation (in Portuguese) lives in **`DOCUMENTACAO.md`**.

## Running locally

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase / Mercado Pago keys
npm run dev
# open http://localhost:3000
```

> Only `NEXT_PUBLIC_*` variables reach the browser. `SUPABASE_SERVICE_ROLE_KEY`,
> `MP_ACCESS_TOKEN` and `MP_CLIENT_SECRET` are **server-only** secrets - never commit them.

Production build:

```bash
npm run build && npm start
```

## Authentication and multi-tenancy

- Every account (`auth.users`) automatically gets an **org** (store) via the `on_auth_user_created` trigger.
- All data (products, sales, resellers, inventory) is isolated per org with **RLS**.
- `SECURITY DEFINER` functions live in the `private` schema (outside the Data API). Security advisors: **clean**.
- Email confirmation is **disabled** (`mailer_autoconfirm`) so sign-up takes under 2 minutes.

## How to use (demo flow)

0. **Create an account** at `/login` (email + password, instant access).
1. **Onboarding** (< 2 min) - choose "start with examples" to get a sample catalog + 3 resellers.
2. **Sell** - tap the center button, pick products, choose channel/reseller, record the sale.
3. **Dashboard** - revenue, profit, pending commission, ranking and chart.
4. **Restock** - automatic purchase suggestions (based on the last 30 days of sales).
5. **Team** - pending commission per reseller + "pay" button and WhatsApp link.

> Each account has its own data (isolated by RLS). To start from scratch, create another account.

## Architecture

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind + lucide + recharts |
| Auth/session | `@supabase/ssr` (cookies) + `middleware.ts` (refresh + route protection) |
| Data | Supabase Postgres - `lib/store.ts` (Zustand write-through) reads/writes via `supabase-js` |
| Business logic | `lib/store.ts` (inventory/commission) + `lib/analytics.ts` (restock/metrics) |
| Payments | Mercado Pago subscriptions (`lib/mercadopago.ts`, `app/api/mercadopago/*`) |
| Schema | `supabase/migrations/*.sql` (multi-tenant + RLS + bootstrap trigger) |

### Structure
```
app/
  (app)/          → authenticated app (painel, vender, produtos, revendedoras,
                    reposicao, financeiro, relatorios, entregas, conversas, ...)
  onboarding/     → self-setup
  loja/[slug]/    → public storefront with chat
  admin/          → super-admin panel
  api/            → server routes (members, admin, Mercado Pago, onboarding)
lib/              → types, store, seed, analytics, plans, permissions
components/       → AppShell (nav), Guard (hydration/onboarding), landing, charts
supabase/         → production SQL migrations
scripts/          → maintenance scripts (e.g. create the super-admin account)
```

## Applying the schema to another Supabase project

1. Create the project and run the files in `supabase/migrations/` in order (SQL Editor or CLI).
2. In **Auth → Providers → Email**, enable *autoconfirm* (or configure SMTP).
3. Fill `.env.local` with the new project's URL and keys.

## Monetization model (summary)

- **Free**: up to 20 products, no resellers (TikTok hook).
- **Pro - R$ 49/month** ⭐: unlimited + resellers + commission + restock.
- **Loja+ - R$ 99/month**: multi-user + reports (price anchoring).

Goal: 10 customers in 72h via manual DMs on Instagram / niche Facebook groups.
