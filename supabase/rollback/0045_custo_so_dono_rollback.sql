-- Desfaz supabase/pos-deploy/0045_custo_so_dono.sql: volta ao estado da 0044 (vendedor lê
-- produto e revendedora pela tabela). Rodar ANTES de voltar o deploy para um código anterior
-- ao equipe_catalogo. Pode rodar mais de uma vez.

drop policy if exists produto_select on public.produto;
create policy produto_select on public.produto for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() in ('owner', 'vendedor'));

drop policy if exists produto_variacao_select on public.produto_variacao;
create policy produto_variacao_select on public.produto_variacao for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() in ('owner', 'vendedor'));

drop policy if exists revendedora_select on public.revendedora;
create policy revendedora_select on public.revendedora for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() in ('owner', 'vendedor'));
