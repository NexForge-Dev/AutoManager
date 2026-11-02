-- ============================================================================
-- Tira o EXECUTE do anon (e do PUBLIC) das RPCs SECURITY DEFINER que só fazem
-- sentido para usuário logado.
--
-- No Supabase, funções novas em public recebem EXECUTE para anon/authenticated
-- por padrão (default privileges) e para PUBLIC (padrão do Postgres). As RPCs
-- abaixo já validam auth.uid()/papel por dentro, mas não há motivo para ficarem
-- chamáveis sem login pela /rest/v1/rpc.
--
-- Inventário (02/11/2026) das chamadas no código:
--   anon (páginas públicas)   -> loja_publica, recuperar_conversa   (MANTIDAS)
--   authenticated             -> revendedora_me, revendedora_catalogo,
--                                revendedora_minhas_vendas, revendedora_registrar_venda
--                                (/acesso e /revenda, sempre depois do login),
--                                registrar_venda, confirmar_entrada,
--                                liberar_revendedora, revogar_revendedora (lib/store.ts)
--   ninguém pelo cliente      -> mudar_plano (só service_role; 0021/0023 já tiraram
--                                de authenticated/PUBLIC, mas o anon ficou)
-- O cliente anônimo do chat da vitrine (signInAnonymously) usa o papel
-- authenticated, não anon: não é afetado.
-- cancelar_venda, entrada_estoque, ajustar_estoque e recalcular_estoque_produto
-- já não têm anon/PUBLIC (0036). As funções do schema private não são expostas
-- pela API e são usadas pelas policies de RLS: ficam como estão.
-- Todas já têm search_path fixo (set search_path = public).
-- ============================================================================

revoke execute on function public.revendedora_me() from public, anon;
revoke execute on function public.revendedora_catalogo() from public, anon;
revoke execute on function public.revendedora_minhas_vendas() from public, anon;
revoke execute on function public.revendedora_registrar_venda(jsonb, text, int, text, numeric) from public, anon;
revoke execute on function public.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean) from public, anon;
revoke execute on function public.confirmar_entrada(uuid, uuid) from public, anon;
revoke execute on function public.liberar_revendedora(uuid) from public, anon;
revoke execute on function public.revogar_revendedora(uuid) from public, anon;
revoke execute on function public.mudar_plano(text) from public, anon, authenticated;

-- garante o acesso de quem usa (idempotente)
grant execute on function public.revendedora_me() to authenticated;
grant execute on function public.revendedora_catalogo() to authenticated;
grant execute on function public.revendedora_minhas_vendas() to authenticated;
grant execute on function public.revendedora_registrar_venda(jsonb, text, int, text, numeric) to authenticated;
grant execute on function public.registrar_venda(uuid, jsonb, text, uuid, text, int, numeric, boolean) to authenticated;
grant execute on function public.confirmar_entrada(uuid, uuid) to authenticated;
grant execute on function public.liberar_revendedora(uuid) to authenticated;
grant execute on function public.revogar_revendedora(uuid) to authenticated;
grant execute on function public.mudar_plano(text) to service_role;
