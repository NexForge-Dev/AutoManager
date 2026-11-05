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
  dono uuid; vend uuid; moto uuid; org uuid; n int; j jsonb;
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
  if public.revendedora_email_em_uso((select id from public.revendedora limit 1)) then
    raise exception 'email_em_uso e so do dono';
  end if;
  execute 'reset role';

  -- dono: tudo
  perform pg_temp.como(dono);
  select count(*) into n from public.usuario; if n < 3 then raise exception 'dono nao viu a equipe'; end if;
  select count(*) into n from public.produto; if n = 0 then raise exception 'dono nao viu produto'; end if;
  execute 'reset role';
end $$;

rollback;
