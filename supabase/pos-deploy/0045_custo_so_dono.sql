-- ============================================================================
-- Rodar SÓ DEPOIS do deploy do código que usa equipe_catalogo/equipe_revendedoras.
-- Fora de supabase/migrations de propósito: com o código antigo no ar, o vendedor
-- ficaria sem catálogo em /vender. Requer a 0044. Pode rodar mais de uma vez.
--
-- Fecha a última parte de AUT-005: o vendedor deixa de ler custo e contato das
-- revendedoras pela API. O catálogo dele vem de public.equipe_catalogo (sem custo).
-- Para reverter: supabase/rollback/0045_custo_so_dono_rollback.sql, ANTES de voltar o deploy.
-- ============================================================================

-- sem a 0044 o vendedor ficaria sem catálogo e sem nenhum erro na tela
do $$
begin
  if to_regprocedure('public.equipe_catalogo(uuid[])') is null then
    raise exception 'Rode a migration 0044 antes desta.';
  end if;
end $$;

drop policy if exists produto_select on public.produto;
create policy produto_select on public.produto for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() = 'owner');

drop policy if exists produto_variacao_select on public.produto_variacao;
create policy produto_variacao_select on public.produto_variacao for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() = 'owner');

drop policy if exists revendedora_select on public.revendedora;
create policy revendedora_select on public.revendedora for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() = 'owner');
