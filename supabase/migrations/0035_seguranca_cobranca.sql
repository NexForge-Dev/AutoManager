-- ============================================================================
-- Endurecimento de segurança + cobrança.
--
--  (1) Signup: org_id/role do convite deixam de vir do user_metadata (que o
--      próprio cliente controla no signUp). Agora só valem do app_metadata,
--      que SÓ a service_role grava. Fecha o "cadastro dentro da loja alheia
--      como owner".
--  (2) Plano efetivo: trial vencido e assinatura ativa com ciclo pago vencido
--      (data_fim + carência) caem no piso AMBULANTE, igual canceled/past_due.
--  (3) Trial: nasce com 1 mês (o produto promete "1º mês grátis") e ganha a
--      coluna trial_usado para o onboarding não poder reiniciá-lo.
--  (4) Super-admin: deixa de ser "quem tem o e-mail admin@automanager.com" e
--      passa a ser app_metadata.role = 'superadmin' (claim do JWT).
--  (5) Limite de plano no usuario também na TROCA de papel (update of role).
--  (6) Código de convite da revendedora sai da tabela revendedora (que
--      vendedor/motoboy leem) para uma tabela sem grants (só service_role/RPC).
--
-- Idempotente: create or replace / drop if exists / add column if not exists.
-- ============================================================================

-- ================================================================ (1) signup
-- Observação: o GoTrue grava o app_metadata customizado do admin.createUser
-- num UPDATE logo após o INSERT (na mesma transação). Por isso o vínculo do
-- convite é feito em DOIS lugares:
--   * handle_new_user (after insert): já trata se o app_metadata vier no insert;
--   * handle_user_app_meta (after update of raw_app_meta_data): trata o caso
--     normal do GoTrue. Ambos são idempotentes (não duplicam a linha).
-- Para o insert NÃO criar uma loja nova para um convidado, as rotas do servidor
-- marcam user_metadata.convite = true. Se um atacante forjar essa marca no
-- signUp, o único efeito é ficar SEM loja (não ganha acesso a nada).

create or replace function private.vincular_convite(u auth.users)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_role text;
begin
  v_org := nullif(u.raw_app_meta_data->>'org_id', '')::uuid;
  v_role := nullif(u.raw_app_meta_data->>'role', '');
  if v_org is null then
    return false;
  end if;
  if exists (select 1 from public.usuario where id = u.id) then
    return true; -- já vinculado (idempotente; não altera papel de quem já existe)
  end if;
  -- convite só cria papéis internos não-dono (nunca owner/superadmin)
  if coalesce(v_role, 'vendedor') not in ('vendedor', 'motoboy') then
    raise exception 'papel_invalido' using detail = coalesce(v_role, '');
  end if;
  insert into public.usuario (id, org_id, nome, email, role)
  values (u.id, v_org, u.raw_user_meta_data->>'nome', u.email, coalesce(v_role, 'vendedor'));
  return true;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nova_org uuid;
begin
  -- visitante anônimo (chat da vitrine) não vira org/usuario
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  -- revendedora: o vínculo (revendedora.user_id) é feito pela rota de ativação;
  -- ela fica isolada das tabelas e só acessa via RPC. Papel vem do app_metadata.
  if nullif(new.raw_app_meta_data->>'role', '') = 'revendedora' then
    return new;
  end if;

  -- convite de membro com app_metadata já presente no insert
  if private.vincular_convite(new) then
    return new;
  end if;

  -- conta criada pelo servidor (convite): o app_metadata chega no UPDATE seguinte.
  -- user_metadata.role é ignorado para permissão; só impede criar loja nova.
  if coalesce(new.raw_user_meta_data->>'convite', '') <> ''
     or nullif(new.raw_user_meta_data->>'role', '') is not null then
    return new;
  end if;

  -- cadastro normal: vira DONO de uma loja nova
  insert into public.org (nome)
  values (coalesce(nullif(new.raw_user_meta_data->>'nome_loja', ''), 'Minha Loja'))
  returning id into nova_org;
  insert into public.usuario (id, org_id, nome, email)
  values (new.id, nova_org, new.raw_user_meta_data->>'nome', new.email);
  return new;
end;
$$;

create or replace function private.handle_user_app_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  if nullif(new.raw_app_meta_data->>'role', '') = 'revendedora' then
    return new;
  end if;
  perform private.vincular_convite(new);
  return new;
end;
$$;

drop trigger if exists on_auth_user_app_meta on auth.users;
create trigger on_auth_user_app_meta
  after update of raw_app_meta_data on auth.users
  for each row
  when (nullif(new.raw_app_meta_data->>'org_id', '') is not null)
  execute function private.handle_user_app_meta();

-- ================================================================ (3) trial
alter table public.assinatura
  add column if not exists trial_usado boolean not null default false;

-- toda assinatura existente já teve (ou dispensou) o trial: não pode reiniciar.
update public.assinatura set trial_usado = true where not trial_usado;

-- Toda org nova nasce em SOLO com TRIAL (acesso EXPANSAO) de 1 mês — "1º mês grátis".
create or replace function private.criar_assinatura_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.assinatura (org_id, plano, status, preco_centavos, trial_ate, trial_usado)
  values (NEW.id, 'solo', 'trialing', 4900, now() + interval '1 month', true)
  on conflict (org_id) do nothing;
  return NEW;
end $$;

-- ================================================================ (2) plano efetivo
-- trial vigente = EXPANSAO; trial vencido / cancelado / inadimplente = AMBULANTE;
-- ativa com ciclo pago vencido há mais de 3 dias (carência p/ atraso do MP) = AMBULANTE.
-- data_fim null em 'active' = sem vencimento (clientes legados / cortesia do admin).
-- Espelha planoEfetivo() de lib/plans.ts.
create or replace function private.plano_efetivo(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when a.status = 'trialing' and a.trial_ate is not null and a.trial_ate > now() then 'expansao'
    when a.status = 'trialing' then 'ambulante'
    when a.status in ('canceled','past_due') then 'ambulante'
    when a.status = 'active' and a.data_fim is not null
         and a.data_fim + interval '3 days' < now() then 'ambulante'
    else a.plano
  end
  from public.assinatura a
  where a.org_id = p_org
$$;

-- ================================================================ (4) super-admin
-- Lê o papel do app_metadata (só a service_role grava) em vez do e-mail.
create or replace function private.eh_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin'
$$;

-- ================================================================ (5) limite de papel
-- Igual a 0029, mas também roda na troca de papel/loja (update), não só no insert.
create or replace function private.checar_papel_membro()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int;
begin
  -- update que não muda papel nem loja: nada a checar
  if TG_OP = 'UPDATE'
     and NEW.role is not distinct from OLD.role
     and NEW.org_id is not distinct from OLD.org_id then
    return NEW;
  end if;
  if NEW.role in ('vendedor','motoboy') and not private.permite_papel(NEW.org_id, NEW.role) then
    raise exception 'papel_nao_permitido' using detail = NEW.role;
  end if;
  if NEW.role = 'vendedor' then
    lim := private.limite_vendedores(NEW.org_id);
    if lim is not null and (
      select count(*) from public.usuario
      where org_id = NEW.org_id and role = 'vendedor' and id <> NEW.id
    ) >= lim then
      raise exception 'limite_vendedores' using detail = lim::text;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_papel_membro on public.usuario;
create trigger trg_papel_membro before insert or update of role, org_id on public.usuario
  for each row execute function private.checar_papel_membro();

-- ================================================================ (6) convite da revendedora
-- vendedor/motoboy precisam ler revendedora (tela Vender escolhe a revendedora),
-- então o select org-wide continua. O que sai de lá é o CÓDIGO de convite: vai
-- para uma tabela sem grants para anon/authenticated (RLS ligada e sem policy).
-- Só as RPCs security definer e a service_role (rota /api/revendedora/ativar) acessam.
create table if not exists public.revendedora_convite (
  revendedora_id uuid primary key references public.revendedora(id) on delete cascade,
  org_id uuid not null references public.org(id) on delete cascade,
  codigo text not null,
  expira timestamptz not null,
  criado_em timestamptz not null default now()
);
alter table public.revendedora_convite enable row level security;
revoke all on public.revendedora_convite from anon, authenticated, public;

-- migra os códigos ainda pendentes e remove as colunas expostas
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revendedora' and column_name = 'acesso_codigo'
  ) then
    insert into public.revendedora_convite (revendedora_id, org_id, codigo, expira)
    select r.id, r.org_id, r.acesso_codigo, coalesce(r.acesso_codigo_expira, now())
    from public.revendedora r
    where r.acesso_codigo is not null and r.user_id is null
    on conflict (revendedora_id) do nothing;
  end if;
end $$;

alter table public.revendedora
  drop column if exists acesso_codigo,
  drop column if exists acesso_codigo_expira;

-- Dono libera o 1º acesso: gera (ou regenera) o código e devolve para ele.
create or replace function public.liberar_revendedora(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := private.current_org_id();
  v_role text := private.current_role();
  v_rev public.revendedora;
  v_codigo text;
  v_expira timestamptz;
begin
  if v_org is null or v_role <> 'owner' then raise exception 'sem_permissao'; end if;

  select * into v_rev from public.revendedora where id = p_id and org_id = v_org;
  if v_rev.id is null then raise exception 'revendedora_invalida'; end if;
  if v_rev.user_id is not null then raise exception 'ja_ativada'; end if;
  if coalesce(v_rev.email, '') = '' then raise exception 'sem_email'; end if;

  v_codigo := private.gerar_codigo_acesso();
  v_expira := now() + interval '7 days';

  update public.revendedora set acesso_liberado = true where id = p_id;

  insert into public.revendedora_convite (revendedora_id, org_id, codigo, expira)
  values (p_id, v_org, v_codigo, v_expira)
  on conflict (revendedora_id) do update
    set codigo = excluded.codigo, expira = excluded.expira, criado_em = now();

  return json_build_object('codigo', v_codigo, 'expira', v_expira);
end;
$$;
grant execute on function public.liberar_revendedora(uuid) to authenticated;

-- Cancela a liberação: apaga o código e desliga o acesso_liberado.
create or replace function public.revogar_revendedora(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := private.current_org_id();
  v_role text := private.current_role();
begin
  if v_org is null or v_role <> 'owner' then raise exception 'sem_permissao'; end if;

  update public.revendedora
    set acesso_liberado = false
    where id = p_id and org_id = v_org;
  delete from public.revendedora_convite
    where revendedora_id = p_id and org_id = v_org;

  return json_build_object('ok', true);
end;
$$;
grant execute on function public.revogar_revendedora(uuid) to authenticated;
