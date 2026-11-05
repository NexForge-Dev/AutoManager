-- Teste de RLS por papel (AUT-005). Rodar num banco LOCAL já migrado e com usuários vendedor
-- e motoboy na mesma loja de um dono:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/papeis.sql
-- Tudo em transação com rollback. Levanta exceção na primeira regra violada.
begin;

create or replace function pg_temp.como(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

do $$
declare
  dono uuid; vend uuid; moto uuid; org uuid; n int; j jsonb; prod uuid; res jsonb;
begin
  select u.org_id, u.id into org, moto from public.usuario u where u.role = 'motoboy' limit 1;
  if org is null then raise exception 'seed: falta um motoboy'; end if;
  select id into vend from public.usuario where org_id = org and role = 'vendedor' limit 1;
  select id into dono from public.usuario where org_id = org and role = 'owner' limit 1;
  if vend is null or dono is null then raise exception 'seed: falta vendedor ou dono na loja do motoboy'; end if;

  -- motoboy: nada de venda, produto, revendedora, nem os outros da equipe
  perform pg_temp.como(moto);
  select count(*) into n from public.venda;            if n <> 0 then raise exception 'motoboy leu venda'; end if;
  select count(*) into n from public.venda_item;       if n <> 0 then raise exception 'motoboy leu venda_item'; end if;
  select count(*) into n from public.produto;          if n <> 0 then raise exception 'motoboy leu produto'; end if;
  select count(*) into n from public.produto_variacao; if n <> 0 then raise exception 'motoboy leu variacao'; end if;
  select count(*) into n from public.revendedora;      if n <> 0 then raise exception 'motoboy leu revendedora'; end if;
  select count(*) into n from public.usuario;          if n <> 1 then raise exception 'motoboy leu a equipe (% linhas)', n; end if;
  if jsonb_array_length(public.equipe_catalogo()) <> 0 then raise exception 'motoboy leu o catalogo'; end if;
  execute 'reset role';

  -- vendedor: sem venda e sem equipe; catálogo sem custo
  perform pg_temp.como(vend);
  select count(*) into n from public.venda;   if n <> 0 then raise exception 'vendedor leu venda'; end if;
  select count(*) into n from public.usuario; if n <> 1 then raise exception 'vendedor leu a equipe'; end if;
  j := public.equipe_catalogo();
  if jsonb_array_length(j) = 0 then raise exception 'vendedor sem catalogo'; end if;
  if j -> 0 ? 'custo' then raise exception 'catalogo expoe custo'; end if;
  if (public.equipe_revendedoras() -> 0) ? 'whatsapp' then raise exception 'revendedoras expoe contato'; end if;
  execute 'reset role';

  -- venda do vendedor grava, mas a resposta não leva custo nem lucro; a do dono leva
  select p.id into prod from public.produto p
  where p.org_id = org and p.estoque_atual > 1
    and not exists (select 1 from public.produto_variacao v where v.produto_id = p.id) limit 1;
  update public.assinatura set status = 'active', plano = 'expansao', data_fim = null, trial_ate = null where org_id = org;
  perform pg_temp.como(vend);
  res := public.registrar_venda(gen_random_uuid(), jsonb_build_array(jsonb_build_object('produto_id', prod, 'qtd', 1)))::jsonb;
  if not (res ? 'total') then raise exception 'venda do vendedor sem total: %', res; end if;
  if res ? 'custo_total' or res ? 'lucro' then raise exception 'registrar_venda expoe custo ao vendedor: %', res; end if;
  execute 'reset role';
  perform pg_temp.como(dono);
  res := public.registrar_venda(gen_random_uuid(), jsonb_build_array(jsonb_build_object('produto_id', prod, 'qtd', 1)))::jsonb;
  if not (res ? 'custo_total') then raise exception 'dono perdeu o custo na resposta: %', res; end if;
  execute 'reset role';

  -- a função original não é chamável direto
  begin
    perform pg_temp.como(vend);
    res := private.registrar_venda_completa(gen_random_uuid(), '[]'::jsonb)::jsonb;
    raise exception 'vendedor chamou a funcao interna';
  exception when insufficient_privilege or invalid_schema_name then null;
  end;
  execute 'reset role';

  -- carência de quem assinou no teste (webhook atrasado)
  update public.assinatura set status = 'trialing', plano = 'equipe', trial_ate = now() - interval '2 hours', data_fim = now() - interval '2 hours' where org_id = org;
  if private.plano_efetivo(org) <> 'equipe' then raise exception 'sem carencia apos o teste: %', private.plano_efetivo(org); end if;
  update public.assinatura set trial_ate = now() - interval '4 days', data_fim = now() - interval '4 days' where org_id = org;
  if private.plano_efetivo(org) <> 'ambulante' then raise exception 'carencia nao terminou'; end if;
  update public.assinatura set trial_ate = now() - interval '2 hours', data_fim = null where org_id = org;
  if private.plano_efetivo(org) <> 'ambulante' then raise exception 'teste sem assinatura ganhou carencia'; end if;
  update public.assinatura set trial_ate = now() + interval '2 days', data_fim = now() + interval '2 days' where org_id = org;
  if private.plano_efetivo(org) <> 'expansao' then raise exception 'teste vigente perdeu o expansao'; end if;

  -- dono: tudo
  perform pg_temp.como(dono);
  select count(*) into n from public.usuario; if n < 3 then raise exception 'dono nao viu a equipe'; end if;
  select count(*) into n from public.produto; if n = 0 then raise exception 'dono nao viu produto'; end if;
  execute 'reset role';
end $$;

rollback;
