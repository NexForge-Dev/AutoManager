-- Desfaz a 0044 (e a 0045, se aplicada): devolve policies, funções e plano_efetivo ao
-- estado da 0043. Não mexe em dados. Pode rodar mais de uma vez.
-- Atenção: reabre custo, lucro e e-mails da equipe pela API, e tira a carência de quem
-- assinou no teste. O código novo segue funcionando (cai nas tabelas).

drop policy if exists venda_select on public.venda;
create policy venda_select on public.venda for select to authenticated
  using (org_id = private.current_org_id());

drop policy if exists venda_item_select on public.venda_item;
create policy venda_item_select on public.venda_item for select to authenticated
  using (org_id = private.current_org_id());

drop policy if exists usuario_select_org on public.usuario;
create policy usuario_select_org on public.usuario for select to authenticated
  using (org_id = private.current_org_id());

drop policy if exists produto_select on public.produto;
create policy produto_select on public.produto for select to authenticated
  using (org_id = private.current_org_id());

drop policy if exists produto_variacao_select on public.produto_variacao;
create policy produto_variacao_select on public.produto_variacao for select to authenticated
  using (org_id = private.current_org_id());

drop policy if exists revendedora_select on public.revendedora;
create policy revendedora_select on public.revendedora for select to authenticated
  using (org_id = private.current_org_id());

drop function if exists public.equipe_catalogo(uuid[]);
drop function if exists public.equipe_revendedoras();
drop function if exists public.revendedora_email_em_uso(uuid);

do $$
begin
  if to_regprocedure('private.registrar_venda_completa(uuid, jsonb, text, uuid, text, int, numeric, boolean)') is not null then
    drop function public.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean);
    alter function private.registrar_venda_completa(uuid, jsonb, text, uuid, text, int, numeric, boolean)
      rename to registrar_venda;
    alter function private.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean) set schema public;
  end if;
end $$;

revoke all on function public.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean) from public, anon;
grant execute on function public.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean) to authenticated, service_role;

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
