-- ============================================================================
-- 0044: cada papel lê só o que usa (AUT-005) + aviso de e-mail já cadastrado (AUT-011)
--
-- A RLS filtra linha, não coluna, e o papel Postgres é um só (authenticated). Antes,
-- qualquer membro lia pela API custo, lucro, vendas e os e-mails da equipe, embora a
-- tela escondesse.
--
-- Esta migration é ADITIVA para o código antigo: nada do que o app em produção usa
-- deixa de funcionar. O motoboy só usa /entregas e /perfil; o vendedor só /vender,
-- /produtos e /perfil (e não lê venda nem a equipe). Pode rodar mais de uma vez.
--
-- Fica para depois do deploy (supabase/pos-deploy/0045_custo_so_dono.sql) tirar do
-- vendedor a leitura direta de produto e revendedora: o código antigo depende dela.
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
drop policy if exists produto_select on public.produto;
create policy produto_select on public.produto for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() in ('owner', 'vendedor'));

drop policy if exists produto_variacao_select on public.produto_variacao;
create policy produto_variacao_select on public.produto_variacao for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() in ('owner', 'vendedor'));

drop policy if exists revendedora_select on public.revendedora;
create policy revendedora_select on public.revendedora for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() in ('owner', 'vendedor'));

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

-- ---------------------------------------------- AUT-011: e-mail da revendedora já tem conta?
-- A ativação cria um login novo e o GoTrue recusa e-mail repetido: o dono precisa saber
-- ao liberar, em vez de ver "Aguardando 1º acesso" para sempre. Só para a própria loja.
create or replace function public.revendedora_email_em_uso(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.revendedora r
    join auth.users u on lower(u.email) = lower(r.email)
    where r.id = p_id
      and r.user_id is null
      and r.org_id = private.current_org_id()
      and private.current_role() = 'owner'
  )
$$;

revoke all on function public.equipe_catalogo(uuid[]) from public, anon;
revoke all on function public.equipe_revendedoras() from public, anon;
revoke all on function public.revendedora_email_em_uso(uuid) from public, anon;
grant execute on function public.equipe_catalogo(uuid[]) to authenticated;
grant execute on function public.equipe_revendedoras() to authenticated;
grant execute on function public.revendedora_email_em_uso(uuid) to authenticated;
