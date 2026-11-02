-- ============================================================================
-- Limite de tentativas (rate limit) para rotas públicas sensíveis, começando
-- pela ativação da revendedora (POST /api/revendedora/ativar: e-mail + código).
--
-- Na Vercel cada request pode cair numa instância serverless diferente, então
-- um contador em memória não segura força bruta: o contador fica no banco.
-- Janela fixa por chave (ex.: "ativar:ip:<hash>"), incremento atômico (upsert).
-- As chaves chegam já com hash (SHA-256) do servidor: nada de IP/e-mail em claro.
-- ============================================================================

create table if not exists public.rate_limite (
  chave text primary key,
  janela_inicio timestamptz not null default now(),
  contagem int not null default 0
);

-- só a service_role (rotas de API no servidor) acessa: RLS ligado e nenhuma policy
alter table public.rate_limite enable row level security;
revoke all on public.rate_limite from anon, authenticated, public;
grant select, insert, update, delete on public.rate_limite to service_role;

-- Conta uma tentativa para p_chave e diz se ela ainda está dentro do limite
-- (true = pode seguir; false = bloqueada até a janela vencer).
create or replace function public.rate_limit_registrar(p_chave text, p_max int, p_janela_segundos int)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contagem int;
  v_janela interval := make_interval(secs => greatest(p_janela_segundos, 1));
begin
  if p_chave is null or length(p_chave) = 0 or length(p_chave) > 200 then
    raise exception 'chave_invalida';
  end if;

  insert into public.rate_limite as r (chave, janela_inicio, contagem)
  values (p_chave, now(), 1)
  on conflict (chave) do update
    set janela_inicio = case when r.janela_inicio <= now() - v_janela then now() else r.janela_inicio end,
        contagem      = case when r.janela_inicio <= now() - v_janela then 1 else r.contagem + 1 end
  returning contagem into v_contagem;

  -- faxina ocasional (~1% das chamadas) das janelas velhas
  if random() < 0.01 then
    delete from public.rate_limite where janela_inicio < now() - interval '1 day';
  end if;

  return v_contagem <= p_max;
end;
$$;

revoke all on function public.rate_limit_registrar(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_registrar(text, int, int) to service_role;
