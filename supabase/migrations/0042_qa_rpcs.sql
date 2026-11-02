-- ============================================================================
-- Endurecimento pós-QA (02/11/2026) — RPCs. Aplicar DEPOIS de 0041_qa_hardening.sql
-- (usa private.membro_no_limite e o índice único revendedora_user_uq de lá).
--
-- Corpos iguais às versões anteriores (0029/0036/0027), mudando só o que cada
-- comentário [#id] indica. Grants/revokes no fim (mesmo padrão do 0040).
-- ============================================================================

-- ------------------------------------------------ revendedora do login atual
-- [#6] lookup determinístico (order by + índice único em user_id), e um único
-- ponto que decide se a revendedora opera: ativa, dentro do limite do plano
-- (0027) e loja com acesso 'ativo' [#8].
create or replace function private.minha_revendedora()
returns setof public.revendedora
language sql
stable
security definer
set search_path = public
as $$
  select r.*
  from public.revendedora r
  join public.org o on o.id = r.org_id
  where r.user_id = auth.uid()
    and r.ativa
    and o.acesso = 'ativo'
    and private.revendedora_no_limite(r.id)
  order by r.criada_em, r.id
  limit 1
$$;
revoke all on function private.minha_revendedora() from public, anon;
grant execute on function private.minha_revendedora() to authenticated;

-- [#6][#8] identidade da revendedora (gate do /acesso e /revenda)
create or replace function public.revendedora_me()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'revendedora_id', r.id,
    'org_id', r.org_id,
    'nome', r.nome,
    'comissao_percent', r.comissao_percent,
    'loja_nome', o.nome,
    'cor_marca', o.cor_marca,
    'logo_url', o.logo_url
  )
  from private.minha_revendedora() r
  join public.org o on o.id = r.org_id
$$;

-- [#11] situação do login como revendedora, para o app distinguir "não é
-- revendedora" (null) de "é, mas a loja suspendeu/o plano não cobre" ('suspensa').
create or replace function public.revendedora_situacao()
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from private.minha_revendedora()) then 'ativa'
    when exists (select 1 from public.revendedora where user_id = auth.uid()) then 'suspensa'
    else null
  end
$$;

-- [#6][#8] catálogo (sem custo)
create or replace function public.revendedora_catalogo()
returns json language sql stable security definer set search_path = public as $$
  with rev as (select org_id from private.minha_revendedora())
  select coalesce((
    select json_agg(json_build_object(
      'id', p.id, 'nome', p.nome, 'categoria', p.categoria, 'marca', p.marca,
      'preco_venda', p.preco_venda, 'preco_comparativo', p.preco_comparativo,
      'imagens', p.imagens, 'estoque_atual', p.estoque_atual,
      'variacoes', coalesce((
        select json_agg(json_build_object(
          'id', v.id, 'nome', v.nome, 'preco_ajuste', v.preco_ajuste, 'estoque_atual', v.estoque_atual
        ) order by v.nome)
        from public.produto_variacao v where v.produto_id = p.id and v.ativo
      ), '[]'::json)
    ) order by p.nome)
    from public.produto p, rev
    where p.org_id = rev.org_id and p.ativo
  ), '[]'::json)
$$;

-- [#2] vendas dela: agora também filtra pela org da revendedora (uma venda de
-- outra loja apontando para ela não aparece mais). [#6][#8] via minha_revendedora.
create or replace function public.revendedora_minhas_vendas()
returns json language sql stable security definer set search_path = public as $$
  with rev as (select id, org_id from private.minha_revendedora())
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
      and s.org_id = rev.org_id
      and coalesce(s.status_pagamento, 'paga') <> 'cancelada'
  ), '[]'::json)
$$;

-- [#16] arredonda total/custo/comissão/lucro/desconto em 2 casas (igual ao
-- registrar_venda) — antes a RPC devolvia 33.325/4.99875 e o banco gravava
-- outro valor. [#6][#8] via minha_revendedora. [#15] canal limitado a 40.
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
  v_lucro numeric;
begin
  select * into v_rev from private.minha_revendedora();
  if v_rev.id is null then raise exception 'sem_acesso'; end if;
  v_org := v_rev.org_id;

  if p_forma not in ('dinheiro','pix','boleto','credito','debito') then p_forma := 'dinheiro'; end if;
  if p_parcelas is null or p_parcelas < 1 then p_parcelas := 1; end if;
  if p_forma <> 'credito' then p_parcelas := 1; end if;
  p_canal := coalesce(nullif(btrim(p_canal), ''), 'whatsapp');
  if char_length(p_canal) > 40 then raise exception 'canal_invalido'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'sem_itens'; end if;

  -- trava (em ordem de id) as linhas de estoque envolvidas (0036)
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

  -- [#16] desconto arredondado ANTES de compor o total: total + desconto = bruto
  v_desc := round(least(greatest(coalesce(p_desconto, 0), 0), v_bruto), 2);
  v_total := round(v_bruto - v_desc, 2);
  v_custo := round(v_custo, 2);
  v_comissao := round(v_total * v_rev.comissao_percent / 100.0, 2);
  v_lucro := round(v_total - v_custo - v_comissao, 2);

  insert into public.venda (id, org_id, canal, revendedora_id, total, custo_total, comissao_total, lucro,
    status_comissao, forma_pagamento, parcelas, status_pagamento, desconto, data_pagamento)
  values (v_venda_id, v_org, p_canal, v_rev.id, v_total, v_custo, v_comissao, v_lucro,
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

-- ---------------------------------------------------------------- registrar_venda
-- [#7] vendedor só registra venda se ainda está dentro do plano efetivo da loja
-- (downgrade/cancelamento cortam quem passou do limite; o dono sempre vende).
-- [#15] canal limitado a 40. [#16] desconto arredondado antes de compor o total.
-- Resto igual ao 0036.
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
  if not private.membro_no_limite() then
    raise exception 'plano_sem_vendedores';
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
  p_canal := coalesce(nullif(btrim(p_canal), ''), 'whatsapp');
  if char_length(p_canal) > 40 then raise exception 'canal_invalido'; end if;

  -- 0) trava (em ordem de id, p/ evitar deadlock) todas as linhas de estoque envolvidas
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

  v_desc := round(least(greatest(coalesce(p_desconto, 0), 0), v_bruto), 2);
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
    'pendente', p_forma, p_parcelas, v_status_pag, v_desc, v_data_pag);

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

-- ---------------------------------------------------------------- vitrine pública
-- [#8] loja desativada/banida pelo super-admin sai do ar. Resto igual ao 0029.
create or replace function public.loja_publica(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'org_id', o.id,
    'nome', o.nome,
    'descricao', o.loja_descricao,
    'logo_url', o.logo_url,
    'capa_url', o.loja_capa_url,
    'cor_marca', o.cor_marca,
    'fonte', o.loja_fonte,
    'sobre', o.loja_sobre,
    'email', o.loja_email,
    'whatsapp', o.loja_whatsapp,
    'telefone', o.loja_telefone,
    'instagram', o.loja_instagram,
    'facebook', o.loja_facebook,
    'tiktok', o.loja_tiktok,
    'produtos', coalesce((
      select json_agg(json_build_object(
        'id', p.id, 'nome', p.nome, 'categoria', p.categoria, 'marca', p.marca,
        'preco_venda', p.preco_venda, 'preco_comparativo', p.preco_comparativo,
        'descricao', p.descricao, 'imagens', p.imagens,
        'esgotado', (p.estoque_atual <= 0),
        'variacoes', coalesce((
          select json_agg(json_build_object(
            'id', v.id, 'nome', v.nome, 'preco_ajuste', v.preco_ajuste,
            'esgotado', (v.estoque_atual <= 0)
          ) order by v.nome)
          from public.produto_variacao v where v.produto_id = p.id and v.ativo
        ), '[]'::json)
      ) order by p.criado_em desc)
      from public.produto p where p.org_id = o.id and p.ativo
    ), '[]'::json)
  )
  from public.org o
  where o.slug = p_slug and o.loja_ativa = true and o.acesso = 'ativo'
$$;

-- ---------------------------------------------------------------- plano para a equipe
-- [#10] a tabela assinatura agora é só do dono (tem provider_cliente_id etc.).
-- Vendedor/motoboy precisam do plano para a UI (usePlano): esta RPC devolve só
-- os campos de plano, sem identificadores do provedor de pagamento.
create or replace function public.minha_assinatura()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'plano', a.plano,
    'status', a.status,
    'preco_centavos', a.preco_centavos,
    'periodo', a.periodo,
    'data_inicio', a.data_inicio,
    'data_fim', a.data_fim,
    'trial_ate', a.trial_ate
  )
  from public.assinatura a
  where a.org_id = private.current_org_id()
$$;

-- ---------------------------------------------------------------- moderação
-- [#8] encerra as sessões (refresh tokens) dos logins afetados por banimento/
-- desativação, para o ban valer já (o GoTrue não revoga sessões no ban).
-- Só a service_role (rota /api/admin/usuario) executa.
create or replace function public.admin_encerrar_sessoes(p_usuarios uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  delete from auth.sessions where user_id = any(coalesce(p_usuarios, '{}'::uuid[]));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------- grants (padrão 0040)
revoke execute on function public.revendedora_me() from public, anon;
revoke execute on function public.revendedora_situacao() from public, anon;
revoke execute on function public.revendedora_catalogo() from public, anon;
revoke execute on function public.revendedora_minhas_vendas() from public, anon;
revoke execute on function public.revendedora_registrar_venda(jsonb, text, int, text, numeric) from public, anon;
revoke execute on function public.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean) from public, anon;
revoke execute on function public.minha_assinatura() from public, anon;
revoke execute on function public.admin_encerrar_sessoes(uuid[]) from public, anon, authenticated;

grant execute on function public.revendedora_me() to authenticated;
grant execute on function public.revendedora_situacao() to authenticated;
grant execute on function public.revendedora_catalogo() to authenticated;
grant execute on function public.revendedora_minhas_vendas() to authenticated;
grant execute on function public.revendedora_registrar_venda(jsonb, text, int, text, numeric) to authenticated;
grant execute on function public.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean) to authenticated;
grant execute on function public.minha_assinatura() to authenticated;
grant execute on function public.loja_publica(text) to anon, authenticated;
grant execute on function public.admin_encerrar_sessoes(uuid[]) to service_role;
