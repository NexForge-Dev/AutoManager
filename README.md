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
- Email confirmation is currently **enabled** on the cloud project (`mailer_autoconfirm = false`): configure a custom SMTP in Supabase before launch, or disable "Confirm email" for instant sign-up. See **`LANCAMENTO.md`** (go-live checklist, in Portuguese).

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

Source of truth: **`lib/plans.ts`** (UI, guards and landing all read from it; DB limits mirror it).
Every new store gets a **1-month free trial** (no card) with Expansão capabilities. After that, a
monthly recurring subscription is charged via **Mercado Pago**.

| Plan | Price | Highlights |
|---|---|---|
| **Ambulante** | R$ 20/month | Inventory, one-tap sales, storefront + chat, basic reports. No resellers. |
| **Solo** | R$ 49/month | Everything above + up to 3 resellers. |
| **Equipe** ⭐ | R$ 99/month | Internal sellers (up to 3), up to 15 resellers, commission + ranking, sales analytics. |
| **Expansão** | R$ 199/month | Unlimited resellers, motoboys + deliveries, advanced analytics (trend/stock-out), priority support. |

## Legal pages and company data

- Public pages (pt-BR): **`/termos`** (Terms of Use), **`/privacidade`** (Privacy Policy / LGPD),
  **`/cancelamento`** (cancellation + 7-day CDC withdrawal right). They are linked from the landing
  footer, the sign-up screen and the plans page, and are public in `lib/supabase/middleware.ts`.
- **`lib/empresa.ts`** holds the company identity shown on those pages, in the landing footer and in
  the WhatsApp buttons: `razaoSocial`, `cnpj`, `emailSuporte`, `whatsappSuporte` (digits only, with
  country code, e.g. `5511999999999`), `cidadeUf` (also used as jurisdiction) and `encarregadoLgpd`.
  **Fill them in before selling.** Empty fields are simply hidden (e.g. no WhatsApp button).
- Password recovery: "Esqueci minha senha" on `/login` sends a Supabase reset e-mail that lands on
  **`/redefinir-senha`**. Add `<your-domain>/redefinir-senha` to *Auth → URL Configuration →
  Redirect URLs* in Supabase.
- SEO: set `NEXT_PUBLIC_APP_URL` (e.g. `https://automanager.com.br`) so `metadataBase`, Open Graph,
  `robots.txt` and `sitemap.xml` use absolute URLs.
