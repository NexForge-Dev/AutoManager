-- ============================================================================
-- 0044: cada papel lê só o que usa (AUT-005) + carência do assinante no fim do teste
--
-- A RLS filtra linha, não coluna, e o papel Postgres é um só (authenticated). Antes,
-- qualquer membro lia pela API custo, lucro, vendas e os e-mails da equipe, embora a
-- tela escondesse.
--
-- Esta migration é ADITIVA para o código antigo: nada do que o app em produção usa
-- deixa de funcionar. O motoboy só usa /entregas e /perfil; o vendedor só /vender,
-- /produtos e /perfil (e não lê venda nem a equipe).
--
-- Pode rodar mais de uma vez, inclusive depois da pos-deploy/0045: quando as policies
-- de produto e revendedora já estão só para o dono, ela não as reabre.
--
-- Fica para depois do deploy (supabase/pos-deploy/0045_custo_so_dono.sql) tirar do
-- vendedor a leitura direta de produto e revendedora: o código antigo depende dela.
-- Para reverter: supabase/rollback/.
-- ============================================================================

-- ---------------------------------------------------------- venda: só o dono
drop policy if exists venda_select on public.venda;
create policy venda_select on public.venda for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() = 'owner');

drop policy if exists venda_item_select on public.venda_item;
create policy venda_item_select on public.venda_item for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() = 'owner');

-- ------------------------------------------- equipe: cada um vê a si; o dono vê todos
-- (usuario_self_select segue valendo para a própria linha)
drop policy if exists usuario_select_org on public.usuario;
create policy usuario_select_org on public.usuario for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() = 'owner');

-- -------------------------------------------------- motoboy não vê produto nem revendedora
do $$
declare
  t text;
  politica text;
begin
  foreach t in array array['produto', 'produto_variacao', 'revendedora'] loop
    politica := t || '_select';
    -- a 0045 já fechou para o dono: rodar a 0044 de novo não pode devolver o custo ao vendedor
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = politica
        and qual like '%current_role%' and qual not like '%vendedor%'
    ) then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', politica, t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (org_id = private.current_org_id() and private.current_role() in (''owner'', ''vendedor''))',
      politica, t);
  end loop;
end $$;

-- ------------------------------------------------------- catálogo do vendedor, sem custo
-- p_ids: só estes produtos (releitura depois de vender); null = todos.
create or replace function public.equipe_catalogo(p_ids uuid[] default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    (to_jsonb(p) - 'custo' - 'imposto_percent')
    || jsonb_build_object('produto_variacao', coalesce(
      (select jsonb_agg(to_jsonb(v)) from public.produto_variacao v where v.produto_id = p.id),
      '[]'::jsonb))
    order by p.criado_em, p.id), '[]'::jsonb)
  from public.produto p
  where p.org_id = private.current_org_id()
    and private.current_role() in ('owner', 'vendedor')
    and (p_ids is null or p.id = any(p_ids))
$$;

-- revendedoras para escolher na venda: sem contato, meta nem vínculo de login
create or replace function public.equipe_revendedoras()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id, 'nome', r.nome, 'ativa', r.ativa,
      'comissao_percent', r.comissao_percent, 'criada_em', r.criada_em)
    order by r.criada_em), '[]'::jsonb)
  from public.revendedora r
  where r.org_id = private.current_org_id()
    and private.current_role() in ('owner', 'vendedor')
$$;

revoke all on function public.equipe_catalogo(uuid[]) from public, anon;
revoke all on function public.equipe_revendedoras() from public, anon;
grant execute on function public.equipe_catalogo(uuid[]) to authenticated;
grant execute on function public.equipe_revendedoras() to authenticated;

-- ------------------------------------------------------ registrar_venda sem custo p/ a equipe
-- A venda continua igual; só a resposta deixa de levar custo e lucro a quem não é dono.
-- A função original vai para private (mesmo corpo, mesmas regras) e a pública vira uma
-- casca com a mesma assinatura. O app lê esses campos com fallback, antigo e novo.
do $$
begin
  if to_regprocedure('private.registrar_venda_completa(uuid, jsonb, text, uuid, text, int, numeric, boolean)') is null then
    alter function public.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean) set schema private;
    alter function private.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean)
      rename to registrar_venda_completa;
  end if;
end $$;

revoke all on function private.registrar_venda_completa(uuid, jsonb, text, uuid, text, int, numeric, boolean)
  from public, anon, authenticated;

create or replace function public.registrar_venda(
  p_venda_id uuid,
  p_itens jsonb,
  p_canal text default 'whatsapp',
  p_revendedora_id uuid default null,
  p_forma text default 'dinheiro',
  p_parcelas int default 1,
  p_desconto numeric default 0,
  p_fiado boolean default false
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_res json;
begin
  v_res := private.registrar_venda_completa(
    p_venda_id, p_itens, p_canal, p_revendedora_id, p_forma, p_parcelas, p_desconto, p_fiado);
  if private.current_role() = 'owner' then
    return v_res;
  end if;
  return (v_res::jsonb - 'custo_total' - 'lucro')::json;
end;
$$;

revoke all on function public.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean) from public, anon;
grant execute on function public.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean) to authenticated, service_role;

-- -------------------------------------------- carência de quem assinou durante o teste
-- Quem assina no teste fica 'trialing' com data_fim (fim do trial no Stripe) até o webhook
-- da 1ª cobrança. Se ele atrasar, vale a mesma carência de 3 dias de 'active', no plano
-- contratado. Teste sem assinatura tem data_fim nula e não muda. Espelha planoEfetivo().
create or replace function private.plano_efetivo(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when a.status = 'trialing' and a.trial_ate is not null and a.trial_ate > now() then 'expansao'
    when a.status = 'trialing' and a.data_fim is not null
         and a.data_fim + interval '3 days' >= now() then a.plano
    when a.status = 'trialing' then 'ambulante'
    when a.status in ('canceled','past_due') then 'ambulante'
    when a.status = 'active' and a.data_fim is not null
         and a.data_fim + interval '3 days' < now() then 'ambulante'
    else a.plano
  end
  from public.assinatura a
  where a.org_id = p_org
$$;
