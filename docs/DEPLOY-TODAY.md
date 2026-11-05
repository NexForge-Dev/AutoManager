# Production deploy — Stripe billing + launch hardening

Target: Supabase project `paqsixfvmbkowedvukgz` (AWS us-east-1) + Vercel, branch `main`.
Written on 2026-11-02, when production ran the Mercado Pago build (`0a066f5`) on a database migrated
up to `0036_estoque_vendas`. The repo has moved on: check what is applied with
`select * from supabase_migrations.schema_migrations` and start from the first missing file, up to
`0044_dados_por_papel`. Run the steps **in this order**; each one is safe to repeat.

`supabase/pos-deploy/0045_custo_so_dono.sql` runs only **after** the code that reads
`equipe_catalogo` is live: with the old code, sellers would lose the catalogue.

New migrations, in apply order:

| # | File | What it does |
|---|---|---|
| 1 | `supabase/migrations/0037_stripe.sql` | `stripe_evento` (webhook idempotency) + Stripe indexes on `assinatura` |
| 2 | `supabase/migrations/0038_rate_limit.sql` | `rate_limite` table + `rate_limit_registrar` RPC (service_role only) |
| 3 | `supabase/migrations/0039_codigo_acesso_sem_vies.sql` | Unbiased invite-code generator (`gen_random_bytes`) |
| 4 | `supabase/migrations/0040_rpc_sem_anon.sql` | Revokes `anon`/`PUBLIC` EXECUTE on logged-in-only RPCs |
| 5 | `supabase/migrations/0041_qa_hardening.sql` | QA hardening: RLS/grants/guard triggers, CHECKs, storage owner-only, org.acesso enforced |
| 6 | `supabase/migrations/0042_qa_rpcs.sql` | QA hardening: rewritten RPCs (plan/org gates, rounding) + `minha_assinatura`, `revendedora_situacao`, `admin_encerrar_sessoes` |
| 7 | `supabase/migrations/0043_auditoria_integridade.sql` | Audit 2026-11-02: variation/delivery must belong to the same store (cross-tenant injection), no support tickets from anonymous storefront sessions, chat flood limits (5 new conversations/h per visitor, 20 msgs/min per conversation, server timestamps), slug/contas/chamado CHECKs, revoke TRUNCATE/TRIGGER/REFERENCES from API roles |

All six are additive/idempotent (`if not exists`, `create or replace`, `revoke`/`grant`,
`not valid` CHECKs). The old Mercado Pago build keeps working on top of 0037–0040 (it never
calls the revoked RPCs as `anon`), so those four can be applied before the new deploy goes live.

**0041/0042 must go together with (or right after) the new app build**, not before it: they
close direct writes the old build still makes (e.g. the inbox writing `conversa.ultima_em`) and
make `assinatura` owner-only (the new build reads the plan through `minha_assinatura`, with a
fallback to the table while 0042 is not applied). Apply 0041 and then 0042 — 0042 depends on
helpers and the unique index created by 0041.

## 0. Pre-flight (local, on the merged `main`)

```bash
npm ci && npm run lint && npm run typecheck && npm test && npm run build
```

`DATABASE_URL` below is the **session pooler / direct** connection string from
Supabase › Project Settings › Database (keep it in `.env.local`, never in Vercel or git).
Load it into the shell without echoing it, e.g. in Git Bash:

```bash
export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')"
```

## 1. Backup

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=private --schema=auth --schema=storage \
  --file="backups/automanager-$(date +%Y%m%d-%H%M).dump"
pg_restore --list backups/automanager-*.dump | head   # sanity check: the file is readable
```

Use `pg_dump` 17 (matches the server). `backups/` must not be committed (dump contains personal data).

## 2. Apply the migrations

Before the deploy (safe with the old build):

```bash
for f in 0037_stripe 0038_rate_limit 0039_codigo_acesso_sem_vies 0040_rpc_sem_anon; do
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f "supabase/migrations/$f.sql" || break
done
```

Right after the new build is live (§5), in this order (0043 needs 0041; it deletes only
variations whose `org_id` differs from their product's store — rows that can only exist through
the cross-tenant bug — and prints a NOTICE with the count):

```bash
for f in 0041_qa_hardening 0042_qa_rpcs 0043_auditoria_integridade; do
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f "supabase/migrations/$f.sql" || break
done
```

0041 prints a `NOTICE` (and keeps the CHECK as `NOT VALID`) if legacy rows break a new rule
(e.g. a negative price, a role outside owner/vendedor/motoboy); new writes are still checked.
Review them with `select conname from pg_constraint where not convalidated;`. It also unlinks
duplicated `revendedora.user_id` links (keeps the oldest) before creating the unique index.

Verify:

```sql
select to_regclass('public.stripe_evento'), to_regclass('public.rate_limite');
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef order by 1;
-- anon = true ONLY for loja_publica and recuperar_conversa
-- (admin_encerrar_sessoes and mudar_plano: false for anon AND authenticated)
select private.gerar_codigo_acesso();   -- 6 chars from ABCDEFGHJKMNPQRSTUVWXYZ23456789
-- after 0041/0042:
select to_regprocedure('public.minha_assinatura()'), to_regprocedure('public.revendedora_situacao()'),
       to_regclass('public.revendedora_user_uq');
select has_table_privilege('authenticated', 'public.venda', 'insert');  -- false
```

**Migration history:** this project has no `supabase_migrations.schema_migrations` table
(migrations were always applied with psql), so `supabase migration repair` is not needed. Only
if you later link the Supabase CLI (`supabase link --project-ref paqsixfvmbkowedvukgz`), register
the history first so `db push` does not re-run everything:
`supabase migration repair --status applied 0001 0002 ... 0042` (one version per file prefix;
there is no `0015_*` file, so skip that number).

## 3. Vercel environment variables (Production)

Vercel › Project › Settings › Environment Variables. `NEXT_PUBLIC_*` are inlined at **build**
time (also used to build the CSP header): change them → redeploy.

| Name | Required | Where the value comes from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase › Project Settings › API › Project URL (`https://paqsixfvmbkowedvukgz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase › Project Settings › API keys › `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (secret) | Supabase › Project Settings › API keys › `service_role` / secret key |
| `NEXT_PUBLIC_APP_URL` | yes | Final public origin, `https://<domain>` without trailing slash |
| `STRIPE_SECRET_KEY` | yes (secret) | Stripe (live mode) › Developers › API keys › `sk_live_...` (or a restricted `rk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | yes (secret) | Stripe › Developers › Webhooks › the endpoint from step 4 › Signing secret `whsec_...` |
| `NEXFORGE_ENDPOINT` | optional | NexForge panel ingest URL (`https://<panel>/api/ingest`); all three empty = metrics off |
| `NEXFORGE_INGEST_KEY` | optional (secret) | NexForge panel › product AutoManager › ingest key `nfk_...` |
| `NEXFORGE_PSEUDONYM_SECRET` | optional (secret) | Random per product: `openssl rand -hex 32` (never reuse/share) |

Do **not** add `DATABASE_URL` or any `MP_*` variable (Mercado Pago is gone; remove old `MP_*`
entries from Vercel if they exist).

## 4. Stripe (live mode)

1. Create products/prices (idempotent, lookup keys `automanager_<plan>`):
   `npm run stripe:sync` reads `.env.local`; a `STRIPE_SECRET_KEY` already set in the shell
   takes precedence, so for live run it with the live key exported only in that terminal.
   It prints `PRODUÇÃO (live)` when using the live key.
2. Developers › Webhooks › Add endpoint: `https://<domain>/api/stripe/webhook`, events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`
   - `invoice.paid`
   - `invoice.payment_failed`

   Copy the signing secret into `STRIPE_WEBHOOK_SECRET` (step 3).
3. Settings › Billing › Customer portal: enable (update card, invoices, cancel).
4. Settings › Billing › Subscriptions and emails › failed payments: retries on, then mark
   unpaid or cancel.
5. Legacy Mercado Pago subscribers: as of 2026-11-02 there are none (`assinatura` has only
   2 `trialing` rows, no `provider = 'mercadopago'`). Re-check right before the deploy:
   `select org_id, plano, status from assinatura where provider = 'mercadopago' and status <> 'canceled';`

## 5. Deploy

Merge `fix/launch` → `dev` → `main` (after approval), push `main`, wait for the Vercel build,
then point/confirm the domain and HTTPS.

Then apply `0041_qa_hardening` and `0042_qa_rpcs` (§2, second block) and run the smoke test
below as owner, vendedor, motoboy and revendedora.

## 6. Super-admin

```bash
node scripts/criar-admin.mjs --email <admin e-mail> --senha "<12+ char password>"
```

Uses `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`. Sign out and
in again to get the `superadmin` claim, then open `/admin`.

## 7. Smoke test

- `GET https://<domain>/api/health` → `{"ok":true,"database":true}` (add it to an uptime monitor).
- `/loja/<unknown-slug>` → 404; `/loja/<real-slug>` → 200 with products.
- Response headers include `Content-Security-Policy` and no `X-Powered-By`; browser console has
  no CSP violations on `/`, `/login`, `/loja/<slug>`, `/painel`.
- Subscribe to the cheapest plan with a real card → plan active in the app; Stripe › Webhooks ›
  Event deliveries all **200**. Cancel via the portal and refund if it was only a test.
- After 0041/0042: storefront chat opens a conversation as an anonymous visitor; a vendedor
  registers a sale on `/vender`; a motoboy takes and finishes a delivery; a revendedora logs in
  on `/acesso` and registers a sale; product images still load on `/loja/<slug>`.
- Rest of the checklist: `LANCAMENTO.md` §7.

## Still needs the owner's data (do not invent)

`lib/empresa.ts` — currently empty, shown on `/termos`, `/privacidade`, `/cancelamento` and
the footer (CDC Decreto 7.962/2013 + LGPD), and the server logs a warning while empty:

- `razaoSocial` — legal name (LTDA / MEI)
- `cnpj` — `00.000.000/0001-00`
- `emailSuporte` — support / cancellation / LGPD requests mailbox
- `cidadeUf` — e.g. `São Paulo/SP` (also the jurisdiction in the Terms)
- `encarregadoLgpd` — DPO name (falls back to the support e-mail if empty)

Also pending outside the code: Supabase Auth SMTP + Site/Redirect URLs (`LANCAMENTO.md` §4).

## Rollback

- App: Vercel › Deployments › promote the previous deployment.
- Database: the migrations are additive; to undo only the permission change re-grant with
  `grant execute on function public.<fn>(<args>) to anon;`. Full restore:
  `pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backups/<file>.dump`
  (last resort — overwrites data written after the backup).
