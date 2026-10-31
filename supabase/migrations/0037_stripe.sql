-- ============================================================================
-- Cobrança pelo Stripe (substitui o Mercado Pago).
-- A tabela public.assinatura já tem os ganchos provider / provider_cliente_id /
-- provider_assinatura_id (0013); aqui só entram o controle de idempotência do
-- webhook e índices para achar a assinatura pelo cliente/assinatura do Stripe.
-- ============================================================================

-- eventos do Stripe já processados (o Stripe reenvia; cada evento aplica uma vez)
create table if not exists public.stripe_evento (
  id text primary key,                 -- evt_...
  tipo text not null,
  processado_em timestamptz not null default now()
);

-- só a service_role (webhook) lê/grava: RLS ligado e nenhuma policy
alter table public.stripe_evento enable row level security;
revoke all on public.stripe_evento from anon, authenticated;

create index if not exists assinatura_provider_cliente_idx
  on public.assinatura (provider_cliente_id) where provider_cliente_id is not null;
create index if not exists assinatura_provider_assinatura_idx
  on public.assinatura (provider_assinatura_id) where provider_assinatura_id is not null;
