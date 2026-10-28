-- ============================================================================
-- Estoque e vendas: integridade sob concorrência + cancelamento de venda.
--
-- 1) cancelar_venda: o status 'cancelada' existia (0002) mas nada o aplicava.
--    Agora o dono cancela numa transação: devolve o estoque (produto e variação),
--    registra o movimento, marca a venda como cancelada e anula a comissão
--    pendente.
-- 2) entrada_estoque / ajustar_estoque / recalcular_estoque_produto: o cliente
--    gravava estoque ABSOLUTO a partir do cache local (valor velho sobrescrevia
--    vendas feitas em paralelo por outra aba/revendedora). Agora a entrada é
--    relativa (estoque_atual + qtd) e o ajuste é feito no banco, com a linha
--    travada e o delta registrado.
-- 3) registrar_venda / revendedora_registrar_venda: checavam o estoque sem
--    travar a linha (duas vendas simultâneas passavam na checagem e vendiam a
--    mesma peça). Redefinidas com SELECT ... FOR UPDATE (corpo igual ao 0026 /
--    0027 no resto). CHECK (estoque_atual >= 0) como rede de segurança.
-- 4) revendedora_minhas_vendas: não lista vendas canceladas no portal dela.
-- ============================================================================

-- ------------------------------------------- ressincroniza agregado da grade
-- Produto com variações: o agregado deve ser a soma das variações (regra do
-- app, `estoqueEfetivo`). As gravações absolutas antigas podem ter deixado o
-- agregado divergente; corrige uma vez para a CHECK abaixo não barrar vendas
-- legítimas de variação por causa de um agregado "atrasado".
update public.produto p
  set estoque_atual = s.soma
  from (
    select produto_id, coalesce(sum(greatest(estoque_atual, 0)), 0)::int as soma
    from public.produto_variacao group by produto_id
  ) s
  where s.produto_id = p.id and p.estoque_atual <> s.soma;

-- ------------------------------------------------------- CHECK estoque >= 0
-- NOT VALID: não valida as linhas antigas (a migration não falha se já houver
-- estoque negativo legado), mas vale para todo INSERT/UPDATE daqui em diante.
-- Obs.: uma linha legada negativa só aceita update que a deixe >= 0
-- (ex.: "Ajustar estoque" para o valor real).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produto_estoque_nao_negativo') then
    alter table public.produto
      add constraint produto_estoque_nao_negativo check (estoque_atual >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'produto_variacao_estoque_nao_negativo') then
    alter table public.produto_variacao
      add constraint produto_variacao_estoque_nao_negativo check (estoque_atual >= 0) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------- registrar_venda
-- Igual ao 0026, + trava das linhas de produto/variação antes de checar estoque.
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
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := private.current_org_id();
  v_role text := private.current_role();
  v_rev public.revendedora;
  v_comissao_pct numeric := 0;
  v_item jsonb;
  v_prod public.produto;
  v_var public.produto_variacao;
  v_preco numeric;
  v_qtd int;
  v_bruto numeric := 0;
  v_custo numeric := 0;
  v_desc numeric;
  v_total numeric;
  v_comissao numeric;
  v_status_pag text;
  v_data_pag timestamptz;
begin
  if v_org is null or v_role not in ('owner','vendedor') then
    raise exception 'sem_permissao';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'sem_itens';
  end if;

  -- revendedora opcional (precisa ser da própria org)
  if p_revendedora_id is not null then
    select * into v_rev from public.revendedora where id = p_revendedora_id and org_id = v_org;
    if v_rev.id is null then raise exception 'revendedora_invalida'; end if;
    v_comissao_pct := coalesce(v_rev.comissao_percent, 0);
  end if;

  if p_forma not in ('dinheiro','pix','boleto','credito','debito') then p_forma := 'dinheiro'; end if;
  if p_parcelas is null or p_parcelas < 1 then p_parcelas := 1; end if;
  if p_forma <> 'credito' then p_parcelas := 1; end if;

  -- 0) trava (em ordem de id, p/ evitar deadlock) todas as linhas de estoque
  --    envolvidas: vendas concorrentes da mesma peça esperam esta terminar.
  perform 1 from public.produto
    where org_id = v_org
      and id in (select nullif(e->>'produto_id','')::uuid from jsonb_array_elements(p_itens) e)
    order by id for update;
  perform 1 from public.produto_variacao
    where org_id = v_org
      and id in (select nullif(e->>'variacao_id','')::uuid from jsonb_array_elements(p_itens) e)
    order by id for update;

  -- 1) valida estoque + soma bruto/custo
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := coalesce((v_item->>'qtd')::int, 0);
    if v_qtd < 1 then raise exception 'qtd_invalida'; end if;
    select * into v_prod from public.produto where id = (v_item->>'produto_id')::uuid and org_id = v_org and ativo for update;
    if v_prod.id is null then raise exception 'produto_invalido'; end if;

    if nullif(v_item->>'variacao_id','') is not null then
      select * into v_var from public.produto_variacao where id = (v_item->>'variacao_id')::uuid and produto_id = v_prod.id and ativo for update;
      if v_var.id is null then raise exception 'variacao_invalida'; end if;
      if v_var.estoque_atual < v_qtd then raise exception 'sem_estoque'; end if;
      v_preco := v_prod.preco_venda + coalesce(v_var.preco_ajuste, 0);
    else
      if exists (select 1 from public.produto_variacao where produto_id = v_prod.id and ativo) then raise exception 'escolha_variacao'; end if;
      if v_prod.estoque_atual < v_qtd then raise exception 'sem_estoque'; end if;
      v_preco := v_prod.preco_venda;
    end if;

    v_bruto := v_bruto + v_preco * v_qtd;
    v_custo := v_custo + v_prod.custo * v_qtd;
  end loop;

  v_desc := least(greatest(coalesce(p_desconto, 0), 0), v_bruto);
  v_total := round(v_bruto - v_desc, 2);
  v_custo := round(v_custo, 2);
  -- comissão sobre o total JÁ com desconto (igual à UI e ao caminho da revendedora)
  v_comissao := round(v_total * v_comissao_pct / 100.0, 2);

  if p_fiado then
    v_status_pag := 'pendente'; v_data_pag := null;
  else
    v_status_pag := 'paga'; v_data_pag := now();
  end if;

  insert into public.venda (id, org_id, canal, revendedora_id, total, custo_total, comissao_total, lucro,
    status_comissao, forma_pagamento, parcelas, status_pagamento, desconto, data_pagamento)
  values (p_venda_id, v_org, p_canal, p_revendedora_id, v_total, v_custo, v_comissao,
    round(v_total - v_custo - v_comissao, 2),
    'pendente', p_forma, p_parcelas, v_status_pag, round(v_desc, 2), v_data_pag);

  -- 2) itens + baixa de estoque (relativa = atômica; CHECK >= 0 barra item repetido estourando)
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item->>'qtd')::int;
    select * into v_prod from public.produto where id = (v_item->>'produto_id')::uuid;
    if nullif(v_item->>'variacao_id','') is not null then
      select * into v_var from public.produto_variacao where id = (v_item->>'variacao_id')::uuid;
      v_preco := v_prod.preco_venda + coalesce(v_var.preco_ajuste, 0);
      update public.produto_variacao set estoque_atual = estoque_atual - v_qtd where id = v_var.id;
      insert into public.venda_item (venda_id, org_id, produto_id, variacao_id, variacao_nome, nome, qtd, preco_unit, custo_unit, comissao_percent_aplicada)
      values (p_venda_id, v_org, v_prod.id, v_var.id, v_var.nome, v_prod.nome, v_qtd, v_preco, v_prod.custo, v_comissao_pct);
    else
      v_preco := v_prod.preco_venda;
      insert into public.venda_item (venda_id, org_id, produto_id, variacao_id, variacao_nome, nome, qtd, preco_unit, custo_unit, comissao_percent_aplicada)
      values (p_venda_id, v_org, v_prod.id, null, null, v_prod.nome, v_qtd, v_preco, v_prod.custo, v_comissao_pct);
    end if;
    update public.produto set estoque_atual = estoque_atual - v_qtd where id = v_prod.id;
    insert into public.movimento_estoque (org_id, produto_id, tipo, qtd, motivo, ref_venda_id)
    values (v_org, v_prod.id, 'saida', v_qtd, 'Venda', p_venda_id);
  end loop;

  return json_build_object('id', p_venda_id, 'total', v_total, 'custo_total', v_custo,
    'comissao_total', v_comissao, 'lucro', round(v_total - v_custo - v_comissao, 2));
end;
$$;
grant execute on function public.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean) to authenticated;

-- ---------------------------------------------------- revendedora_registrar_venda
-- Igual ao 0027, + trava das linhas de produto/variação antes de checar estoque.
create or replace function public.revendedora_registrar_venda(
  p_itens jsonb,
  p_forma text default 'dinheiro',
  p_parcelas int default 1,
  p_canal text default 'whatsapp',
  p_desconto numeric default 0
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_rev public.revendedora;
  v_org uuid;
  v_venda_id uuid := gen_random_uuid();
  v_item jsonb;
  v_prod public.produto;
  v_var public.produto_variacao;
  v_preco numeric;
  v_qtd int;
  v_bruto numeric := 0;
  v_custo numeric := 0;
  v_desc numeric;
  v_total numeric;
  v_comissao numeric;
begin
  select * into v_rev from public.revendedora
    where user_id = auth.uid() and ativa and private.revendedora_no_limite(id) limit 1;
  if v_rev.id is null then raise exception 'sem_acesso'; end if;
  v_org := v_rev.org_id;

  if p_forma not in ('dinheiro','pix','boleto','credito','debito') then p_forma := 'dinheiro'; end if;
  if p_parcelas is null or p_parcelas < 1 then p_parcelas := 1; end if;
  if p_forma <> 'credito' then p_parcelas := 1; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'sem_itens'; end if;

  -- trava (em ordem de id) as linhas de estoque envolvidas
  perform 1 from public.produto
    where org_id = v_org
      and id in (select nullif(e->>'produto_id','')::uuid from jsonb_array_elements(p_itens) e)
    order by id for update;
  perform 1 from public.produto_variacao
    where org_id = v_org
      and id in (select nullif(e->>'variacao_id','')::uuid from jsonb_array_elements(p_itens) e)
    order by id for update;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := coalesce((v_item->>'qtd')::int, 0);
    if v_qtd < 1 then raise exception 'qtd_invalida'; end if;
    select * into v_prod from public.produto where id = (v_item->>'produto_id')::uuid and org_id = v_org and ativo for update;
    if v_prod.id is null then raise exception 'produto_invalido'; end if;

    if nullif(v_item->>'variacao_id','') is not null then
      select * into v_var from public.produto_variacao where id = (v_item->>'variacao_id')::uuid and produto_id = v_prod.id and ativo for update;
      if v_var.id is null then raise exception 'variacao_invalida'; end if;
      if v_var.estoque_atual < v_qtd then raise exception 'sem_estoque'; end if;
      v_preco := v_prod.preco_venda + coalesce(v_var.preco_ajuste, 0);
    else
      if exists (select 1 from public.produto_variacao where produto_id = v_prod.id and ativo) then raise exception 'escolha_variacao'; end if;
      if v_prod.estoque_atual < v_qtd then raise exception 'sem_estoque'; end if;
      v_preco := v_prod.preco_venda;
    end if;

    v_bruto := v_bruto + v_preco * v_qtd;
    v_custo := v_custo + v_prod.custo * v_qtd;
  end loop;

  v_desc := least(greatest(coalesce(p_desconto, 0), 0), v_bruto);
  v_total := v_bruto - v_desc;
  v_comissao := v_total * v_rev.comissao_percent / 100.0;

  insert into public.venda (id, org_id, canal, revendedora_id, total, custo_total, comissao_total, lucro,
    status_comissao, forma_pagamento, parcelas, status_pagamento, desconto, data_pagamento)
  values (v_venda_id, v_org, p_canal, v_rev.id, v_total, v_custo, v_comissao, v_total - v_custo - v_comissao,
    'pendente', p_forma, p_parcelas, 'paga', v_desc, now());

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item->>'qtd')::int;
    select * into v_prod from public.produto where id = (v_item->>'produto_id')::uuid;
    if nullif(v_item->>'variacao_id','') is not null then
      select * into v_var from public.produto_variacao where id = (v_item->>'variacao_id')::uuid;
      v_preco := v_prod.preco_venda + coalesce(v_var.preco_ajuste, 0);
      update public.produto_variacao set estoque_atual = estoque_atual - v_qtd where id = v_var.id;
      insert into public.venda_item (venda_id, org_id, produto_id, variacao_id, variacao_nome, nome, qtd, preco_unit, custo_unit, comissao_percent_aplicada)
      values (v_venda_id, v_org, v_prod.id, v_var.id, v_var.nome, v_prod.nome, v_qtd, v_preco, v_prod.custo, v_rev.comissao_percent);
    else
      v_preco := v_prod.preco_venda;
      insert into public.venda_item (venda_id, org_id, produto_id, variacao_id, variacao_nome, nome, qtd, preco_unit, custo_unit, comissao_percent_aplicada)
      values (v_venda_id, v_org, v_prod.id, null, null, v_prod.nome, v_qtd, v_preco, v_prod.custo, v_rev.comissao_percent);
    end if;
    update public.produto set estoque_atual = estoque_atual - v_qtd where id = v_prod.id;
    insert into public.movimento_estoque (org_id, produto_id, tipo, qtd, motivo, ref_venda_id)
    values (v_org, v_prod.id, 'saida', v_qtd, 'Venda revendedora', v_venda_id);
  end loop;

  return json_build_object('id', v_venda_id, 'total', v_total, 'comissao', v_comissao);
end;
$$;
grant execute on function public.revendedora_registrar_venda(jsonb, text, int, text, numeric) to authenticated;

-- ------------------------------------------------------ revendedora_minhas_vendas
-- Igual ao 0027, mas sem as vendas canceladas pelo dono.
create or replace function public.revendedora_minhas_vendas()
returns json language sql stable security definer set search_path = public as $$
  with rev as (
    select id from public.revendedora
    where user_id = auth.uid() and ativa and private.revendedora_no_limite(id)
    limit 1
  )
  select coalesce((
    select json_agg(json_build_object(
      'id', s.id, 'data', s.data, 'total', s.total, 'comissao_total', s.comissao_total,
      'forma_pagamento', s.forma_pagamento, 'parcelas', s.parcelas,
      'status_comissao', s.status_comissao,
      'itens', coalesce((
        select json_agg(json_build_object('nome', i.nome, 'qtd', i.qtd, 'variacao_nome', i.variacao_nome))
        from public.venda_item i where i.venda_id = s.id
      ), '[]'::json)
    ) order by s.data desc)
    from public.venda s, rev
    where s.revendedora_id = rev.id
      and coalesce(s.status_pagamento, 'paga') <> 'cancelada'
  ), '[]'::json)
$$;
grant execute on function public.revendedora_minhas_vendas() to authenticated;

-- ------------------------------------------------------------------ cancelar_venda
-- Só o dono. Devolve o estoque de cada item (variação + agregado do produto),
-- registra movimento 'entrada' ligado à venda, marca status_pagamento =
-- 'cancelada' e anula a comissão ainda pendente (status 'cancelada', valor 0).
-- Comissão já paga fica como está (o acerto com a revendedora é manual).
create or replace function public.cancelar_venda(p_venda uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := private.current_org_id();
  v_role text := private.current_role();
  v_venda public.venda;
  v_it public.venda_item;
begin
  if v_org is null or v_role <> 'owner' then raise exception 'sem_permissao'; end if;

  -- trava a venda: bloqueia cancelamento concorrente (duplo clique / 2ª aba)
  select * into v_venda from public.venda where id = p_venda and org_id = v_org for update;
  if v_venda.id is null then raise exception 'venda_invalida'; end if;
  if v_venda.status_pagamento = 'cancelada' then raise exception 'ja_cancelada'; end if;

  -- trava as linhas de estoque envolvidas (em ordem de id)
  perform 1 from public.produto
    where org_id = v_org
      and id in (select produto_id from public.venda_item where venda_id = p_venda)
    order by id for update;
  perform 1 from public.produto_variacao
    where org_id = v_org
      and id in (select variacao_id from public.venda_item where venda_id = p_venda)
    order by id for update;

  for v_it in select * from public.venda_item where venda_id = p_venda loop
    -- produto excluído depois da venda: não há estoque para devolver
    continue when v_it.produto_id is null;

    if v_it.variacao_id is not null then
      update public.produto_variacao set estoque_atual = estoque_atual + v_it.qtd
        where id = v_it.variacao_id and org_id = v_org;
    elsif v_it.variacao_nome is not null then
      -- era venda de variação que já foi excluída: devolver só no agregado criaria
      -- estoque "fantasma" (o agregado de produto com grade é a soma das variações)
      continue;
    end if;

    update public.produto set estoque_atual = estoque_atual + v_it.qtd
      where id = v_it.produto_id and org_id = v_org;
    insert into public.movimento_estoque (org_id, produto_id, tipo, qtd, motivo, ref_venda_id)
    values (v_org, v_it.produto_id, 'entrada', v_it.qtd, 'Cancelamento de venda', p_venda);
  end loop;

  update public.venda set
    status_pagamento = 'cancelada',
    status_comissao = case when status_comissao = 'pendente' then 'cancelada' else status_comissao end,
    comissao_total  = case when status_comissao = 'pendente' then 0 else comissao_total end,
    lucro           = case when status_comissao = 'pendente' then round(total - custo_total, 2) else lucro end
  where id = p_venda
  returning * into v_venda;

  return json_build_object('id', v_venda.id, 'status_pagamento', v_venda.status_pagamento,
    'status_comissao', v_venda.status_comissao, 'comissao_total', v_venda.comissao_total,
    'lucro', v_venda.lucro);
end;
$$;
revoke all on function public.cancelar_venda(uuid) from public, anon;
grant execute on function public.cancelar_venda(uuid) to authenticated;

-- ----------------------------------------------------------------- entrada_estoque
-- Reposição RELATIVA (estoque_atual + qtd), com a linha travada. Em produto com
-- grade a entrada é obrigatoriamente numa variação (o agregado sobe junto).
create or replace function public.entrada_estoque(
  p_produto uuid,
  p_variacao uuid default null,
  p_qtd int default 1,
  p_obs text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := private.current_org_id();
  v_role text := private.current_role();
  v_prod public.produto;
  v_var public.produto_variacao;
begin
  if v_org is null or v_role <> 'owner' then raise exception 'sem_permissao'; end if;
  if p_qtd is null or p_qtd < 1 then raise exception 'qtd_invalida'; end if;

  select * into v_prod from public.produto where id = p_produto and org_id = v_org for update;
  if v_prod.id is null then raise exception 'produto_invalido'; end if;

  if p_variacao is not null then
    select * into v_var from public.produto_variacao
      where id = p_variacao and produto_id = v_prod.id for update;
    if v_var.id is null then raise exception 'variacao_invalida'; end if;
    update public.produto_variacao set estoque_atual = estoque_atual + p_qtd
      where id = v_var.id returning * into v_var;
  elsif exists (select 1 from public.produto_variacao where produto_id = v_prod.id) then
    raise exception 'escolha_variacao';
  end if;

  update public.produto set estoque_atual = estoque_atual + p_qtd
    where id = v_prod.id returning * into v_prod;

  insert into public.movimento_estoque (org_id, produto_id, tipo, qtd, motivo)
  values (v_org, v_prod.id, 'entrada', p_qtd, coalesce(nullif(trim(p_obs), ''), 'Reposição de estoque'));

  return json_build_object('produto_id', v_prod.id, 'estoque_produto', v_prod.estoque_atual,
    'variacao_id', v_var.id, 'estoque_variacao', v_var.estoque_atual);
end;
$$;
revoke all on function public.entrada_estoque(uuid, uuid, int, text) from public, anon;
grant execute on function public.entrada_estoque(uuid, uuid, int, text) to authenticated;

-- ----------------------------------------------------------------- ajustar_estoque
-- Define o estoque (contagem física) no banco, com a linha travada, e registra
-- o DELTA real (novo - atual do banco, não do cache do cliente). Em variação,
-- o agregado do produto acompanha o mesmo delta.
create or replace function public.ajustar_estoque(
  p_produto uuid,
  p_variacao uuid default null,
  p_qtd int default 0,
  p_motivo text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := private.current_org_id();
  v_role text := private.current_role();
  v_prod public.produto;
  v_var public.produto_variacao;
  v_delta int;
begin
  if v_org is null or v_role <> 'owner' then raise exception 'sem_permissao'; end if;
  if p_qtd is null or p_qtd < 0 then raise exception 'qtd_invalida'; end if;

  select * into v_prod from public.produto where id = p_produto and org_id = v_org for update;
  if v_prod.id is null then raise exception 'produto_invalido'; end if;

  if p_variacao is not null then
    select * into v_var from public.produto_variacao
      where id = p_variacao and produto_id = v_prod.id for update;
    if v_var.id is null then raise exception 'variacao_invalida'; end if;
    v_delta := p_qtd - v_var.estoque_atual;
    update public.produto_variacao set estoque_atual = p_qtd where id = v_var.id returning * into v_var;
    update public.produto set estoque_atual = greatest(estoque_atual + v_delta, 0)
      where id = v_prod.id returning * into v_prod;
  else
    if exists (select 1 from public.produto_variacao where produto_id = v_prod.id) then
      raise exception 'escolha_variacao';
    end if;
    v_delta := p_qtd - v_prod.estoque_atual;
    update public.produto set estoque_atual = p_qtd where id = v_prod.id returning * into v_prod;
  end if;

  if v_delta <> 0 then
    insert into public.movimento_estoque (org_id, produto_id, tipo, qtd, motivo)
    values (v_org, v_prod.id, 'ajuste', v_delta, coalesce(nullif(trim(p_motivo), ''), 'Ajuste manual'));
  end if;

  return json_build_object('produto_id', v_prod.id, 'estoque_produto', v_prod.estoque_atual,
    'variacao_id', v_var.id, 'estoque_variacao', v_var.estoque_atual, 'delta', v_delta);
end;
$$;
revoke all on function public.ajustar_estoque(uuid, uuid, int, text) from public, anon;
grant execute on function public.ajustar_estoque(uuid, uuid, int, text) to authenticated;

-- ------------------------------------------------------ recalcular_estoque_produto
-- Produto com grade: o agregado = soma das variações, calculado NO BANCO (depois
-- de incluir/excluir variações na edição), em vez de gravar a soma do cache.
-- Sem variações: não mexe (o estoque base é o próprio agregado).
create or replace function public.recalcular_estoque_produto(p_produto uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := private.current_org_id();
  v_role text := private.current_role();
  v_prod public.produto;
begin
  if v_org is null or v_role <> 'owner' then raise exception 'sem_permissao'; end if;

  select * into v_prod from public.produto where id = p_produto and org_id = v_org for update;
  if v_prod.id is null then raise exception 'produto_invalido'; end if;

  if exists (select 1 from public.produto_variacao where produto_id = v_prod.id) then
    update public.produto set estoque_atual = (
      select coalesce(sum(greatest(estoque_atual, 0)), 0)::int
      from public.produto_variacao where produto_id = v_prod.id
    )
    where id = v_prod.id returning * into v_prod;
  end if;

  return json_build_object('produto_id', v_prod.id, 'estoque_produto', v_prod.estoque_atual);
end;
$$;
revoke all on function public.recalcular_estoque_produto(uuid) from public, anon;
grant execute on function public.recalcular_estoque_produto(uuid) to authenticated;
