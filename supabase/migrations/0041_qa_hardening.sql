-- ============================================================================
-- Endurecimento pós-QA (02/11/2026) — permissões, RLS, triggers e CHECKs.
-- As RPCs reescritas ficam em 0042_qa_rpcs.sql (aplicar 0041 e depois 0042).
--
-- Cada bloco traz o id do achado do QA entre colchetes ([#1], [#2]...).
-- Idempotente: create or replace / drop ... if exists / checagem em pg_catalog.
--
-- Padrão usado nos triggers de "coluna travada": private.via_api_cliente() é
-- SECURITY INVOKER e diz se a escrita veio direto da Data API como usuário
-- (current_user = authenticated/anon). Dentro das RPCs SECURITY DEFINER e dos
-- triggers definer o current_user é o dono das funções (postgres), e a
-- service_role (rotas do servidor) tem papel próprio — esses caminhos seguem
-- livres. Assim a regra vale para o cliente sem quebrar os caminhos oficiais.
-- ============================================================================

-- [geral] escrita veio do cliente (PostgREST como usuário)?
create or replace function private.via_api_cliente()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('authenticated', 'anon')
$$;
grant execute on function private.via_api_cliente() to anon, authenticated;

-- ============================================================ [#8] org.acesso
-- [#8] current_org_id passa a exigir loja ATIVA: um JWT emitido antes do ban/
-- desativação para de enxergar/gravar dados da loja na hora (todas as policies
-- tenant usam esta função). Revendedoras/vitrine são cortadas em 0042.
create or replace function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.org_id
  from public.usuario u
  join public.org o on o.id = u.org_id
  where u.id = auth.uid() and o.acesso = 'ativo'
$$;

-- [#8] valores válidos de org.acesso (NOT VALID + validate: não quebra legado).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'org_acesso_valido') then
    alter table public.org add constraint org_acesso_valido
      check (acesso in ('ativo', 'desativado', 'banido')) not valid;
  end if;
  begin
    alter table public.org validate constraint org_acesso_valido;
  exception when check_violation then
    raise notice 'org_acesso_valido ficou NOT VALID: há org.acesso fora de ativo/desativado/banido';
  end;
end $$;

-- [#8] o dono não altera org.acesso (era possível "se desbanir" pelo rótulo,
-- que agora controla o acesso de verdade). Só service_role (/api/admin/usuario).
create or replace function private.org_guarda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.via_api_cliente() and (
       NEW.id is distinct from OLD.id
    or NEW.acesso is distinct from OLD.acesso
    or NEW.criada_em is distinct from OLD.criada_em) then
    raise exception 'org_campo_protegido';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_org_guarda on public.org;
create trigger trg_org_guarda before update on public.org
  for each row execute function private.org_guarda();

-- ============================================================ [#1] chat: criar conversa
-- [#1] a policy antiga fazia exists(select from org ...) sujeito à RLS de org:
-- o visitante anônimo não enxerga a org, então NUNCA conseguia abrir conversa.
-- O helper SECURITY DEFINER consulta a org sem RLS e só devolve um booleano.
create or replace function private.loja_ativa(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org o
    where o.id = p_org and o.loja_ativa and o.acesso = 'ativo'
  )
$$;
revoke all on function private.loja_ativa(uuid) from public;
grant execute on function private.loja_ativa(uuid) to anon, authenticated;

-- [#1] conversa: só cria como o próprio cliente e para loja ativa (e não banida [#8]).
drop policy if exists conversa_insert on public.conversa;
create policy conversa_insert on public.conversa for insert to authenticated
  with check (
    cliente_id = (select auth.uid())
    and private.loja_ativa(org_id)
  );

-- [#1][#8] mensagem do cliente só para loja ativa; dono só na própria org (0028).
drop policy if exists mensagem_insert on public.mensagem;
create policy mensagem_insert on public.mensagem for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and char_length(texto) between 1 and 2000
    and org_id = (select c.org_id from public.conversa c where c.id = conversa_id)
    and exists (
      select 1 from public.conversa c where c.id = conversa_id and (
        (c.cliente_id = (select auth.uid()) and autor_tipo = 'cliente' and private.loja_ativa(c.org_id))
        or (c.org_id = private.current_org_id() and private.current_role() = 'owner' and autor_tipo = 'loja')
      )
    )
  );

-- [#19] conversa: o cliente não mexe em ultima_em/ultima_cliente_em/cliente_token/
-- cliente_id/criada_em (furava a ordem do inbox e o token de recuperação).
-- ultima_em é mantida pelo trigger trg_bump_conversa (0019, SECURITY DEFINER) a
-- cada mensagem, e recuperar_conversa (definer) religa cliente_id — ambos seguem.
-- No INSERT feito pelo cliente, os carimbos de tempo são do servidor.
-- (antes era SECURITY DEFINER; agora INVOKER para enxergar quem chamou)
create or replace function private.conversa_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if private.via_api_cliente() then
      NEW.criada_em := now();
      NEW.ultima_em := now();
      NEW.ultima_cliente_em := null;
    end if;
    return NEW;
  end if;
  -- (0028) org_id é imutável para todos (impede mover a conversa p/ outro inbox)
  if NEW.org_id is distinct from OLD.org_id or NEW.id is distinct from OLD.id then
    raise exception 'conversa_imutavel';
  end if;
  if private.via_api_cliente() and (
       NEW.cliente_id is distinct from OLD.cliente_id
    or NEW.cliente_token is distinct from OLD.cliente_token
    or NEW.ultima_em is distinct from OLD.ultima_em
    or NEW.ultima_cliente_em is distinct from OLD.ultima_cliente_em
    or NEW.criada_em is distinct from OLD.criada_em) then
    raise exception 'conversa_imutavel';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_conversa_imutavel on public.conversa;
create trigger trg_conversa_imutavel before insert or update on public.conversa
  for each row execute function private.conversa_imutavel();

-- ============================================================ [#2][#3] vendas e estoque
-- [#2] venda: INSERT/DELETE diretos fechados (total/lucro/comissão livres, venda
-- falsa). Vendas nascem só pelas RPCs SECURITY DEFINER (registrar_venda,
-- revendedora_registrar_venda, confirmar_entrada) e cancelam por cancelar_venda.
-- O dono ainda faz UPDATE direto de 3 colunas (lib/store.ts: marcarComissaoPaga,
-- marcarVendaRecebida) — só elas recebem grant.
revoke insert, update, delete on public.venda from anon, authenticated;
grant select on public.venda to authenticated;
grant update (status_comissao, status_pagamento, data_pagamento) on public.venda to authenticated;
drop policy if exists venda_insert on public.venda;
drop policy if exists venda_delete on public.venda;

-- [#2] cancelar (e "descancelar") só pela RPC cancelar_venda, que devolve o estoque.
create or replace function private.venda_guarda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.via_api_cliente() and (
       (NEW.status_pagamento = 'cancelada') is distinct from (OLD.status_pagamento = 'cancelada')
    or (NEW.status_comissao = 'cancelada') is distinct from (OLD.status_comissao = 'cancelada')) then
    raise exception 'use_cancelar_venda';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_venda_guarda on public.venda;
create trigger trg_venda_guarda before update on public.venda
  for each row execute function private.venda_guarda();

-- [#2] venda.revendedora_id precisa ser da MESMA org da venda (vale para todos os
-- caminhos, inclusive service_role). Antes dava para lançar venda/comissão na
-- conta de uma revendedora de outra loja.
create or replace function private.venda_revendedora_mesma_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.revendedora_id is not null and not exists (
    select 1 from public.revendedora r where r.id = NEW.revendedora_id and r.org_id = NEW.org_id
  ) then
    raise exception 'revendedora_invalida';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_venda_revendedora_org on public.venda;
create trigger trg_venda_revendedora_org before insert or update of revendedora_id, org_id on public.venda
  for each row execute function private.venda_revendedora_mesma_org();

-- [#2][#3] venda_item: só as RPCs gravam (qualquer membro alterava preço/apagava itens).
revoke insert, update, delete on public.venda_item from anon, authenticated;
grant select on public.venda_item to authenticated;
drop policy if exists venda_item_insert on public.venda_item;
drop policy if exists venda_item_update on public.venda_item;
drop policy if exists venda_item_delete on public.venda_item;

-- [#2][#3] movimento_estoque: append-only. O dono ainda grava a "entrada" de
-- estoque inicial no cadastro/importação de produto (lib/store.ts addProduto/
-- importarProdutos); saída/ajuste/cancelamento só pelas RPCs.
revoke insert, update, delete on public.movimento_estoque from anon, authenticated;
grant select, insert on public.movimento_estoque to authenticated;
drop policy if exists movimento_estoque_update on public.movimento_estoque;
drop policy if exists movimento_estoque_delete on public.movimento_estoque;
drop policy if exists movimento_estoque_insert on public.movimento_estoque;
create policy movimento_estoque_insert on public.movimento_estoque for insert to authenticated
  with check (
    org_id = private.current_org_id()
    and private.current_role() = 'owner'
    and tipo = 'entrada'
    and qtd > 0
    and ref_venda_id is null
  );

-- [#3] entrada_pendente (caixa de recebimentos): exclusiva do dono (a tela
-- /recebimentos já é só do dono). "confirmada" só via RPC confirmar_entrada.
revoke all on public.entrada_pendente from anon;
drop policy if exists entrada_pendente_select on public.entrada_pendente;
drop policy if exists entrada_pendente_insert on public.entrada_pendente;
drop policy if exists entrada_pendente_update on public.entrada_pendente;
drop policy if exists entrada_pendente_delete on public.entrada_pendente;
create policy entrada_pendente_select on public.entrada_pendente for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() = 'owner');
create policy entrada_pendente_insert on public.entrada_pendente for insert to authenticated
  with check (
    org_id = private.current_org_id() and private.current_role() = 'owner'
    and status = 'pendente' and venda_id is null
  );
create policy entrada_pendente_update on public.entrada_pendente for update to authenticated
  using (org_id = private.current_org_id() and private.current_role() = 'owner')
  with check (
    org_id = private.current_org_id() and private.current_role() = 'owner'
    and status in ('pendente', 'recusada') and venda_id is null
  );
create policy entrada_pendente_delete on public.entrada_pendente for delete to authenticated
  using (org_id = private.current_org_id() and private.current_role() = 'owner');

-- ============================================================ [#10] dados financeiros
-- [#10] contas a pagar e assinatura (provider_cliente_id etc.): só o dono lê.
-- Vendedor/motoboy obtêm o plano da loja pela RPC public.minha_assinatura (0042).
drop policy if exists conta_pagar_select on public.conta_pagar;
create policy conta_pagar_select on public.conta_pagar for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() = 'owner');

drop policy if exists assinatura_select on public.assinatura;
create policy assinatura_select on public.assinatura for select to authenticated
  using (org_id = private.current_org_id() and private.current_role() = 'owner');

-- ============================================================ [#6] vínculo da revendedora
-- [#6] user_id/acesso_liberado só mudam pelos caminhos oficiais: ativação
-- (/api/revendedora/ativar, service_role) e liberar/revogar_revendedora
-- (SECURITY DEFINER). O dono apontava user_id para o login de outra pessoa e
-- "sequestrava" a conta dela para dentro do /revenda da loja dele.
-- [#5] o e-mail é guardado normalizado (lower/trim) para a ativação casar por
-- igualdade exata (antes: ilike, onde % e _ viravam curingas).
create or replace function private.revendedora_guarda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  NEW.email := nullif(lower(btrim(NEW.email)), '');
  if private.via_api_cliente() then
    if TG_OP = 'INSERT' then
      if NEW.user_id is not null or coalesce(NEW.acesso_liberado, false) then
        raise exception 'vinculo_somente_pela_ativacao';
      end if;
    elsif NEW.id is distinct from OLD.id
       or NEW.user_id is distinct from OLD.user_id
       or NEW.acesso_liberado is distinct from OLD.acesso_liberado then
      raise exception 'vinculo_somente_pela_ativacao';
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_revendedora_guarda on public.revendedora;
create trigger trg_revendedora_guarda before insert or update on public.revendedora
  for each row execute function private.revendedora_guarda();

-- [#5] normaliza os e-mails já gravados
update public.revendedora
  set email = nullif(lower(btrim(email)), '')
  where email is distinct from nullif(lower(btrim(email)), '');

-- [#6] um login vincula no máximo UMA revendedora. Vínculos duplicados (só
-- possíveis pelo furo acima) ficam com a revendedora mais antiga; as demais são
-- desvinculadas antes do índice único.
do $$
declare n int;
begin
  with dup as (
    select id, row_number() over (partition by user_id order by criada_em, id) as rn
    from public.revendedora where user_id is not null
  )
  update public.revendedora r set user_id = null, acesso_liberado = false
  from dup where dup.id = r.id and dup.rn > 1;
  get diagnostics n = row_count;
  if n > 0 then
    raise notice '[#6] % revendedora(s) com login duplicado foram desvinculadas', n;
  end if;
end $$;
create unique index if not exists revendedora_user_uq
  on public.revendedora(user_id) where user_id is not null;

-- ============================================================ [#4] corrida nos limites do plano
-- [#4] a contagem do limite rodava sem trava: N cadastros em paralelo viam a
-- mesma contagem e passavam todos (Equipe = 3 virou 5). A trava advisory por org
-- serializa os inserts/updates concorrentes até o commit; o count roda depois.
create or replace function private.checar_papel_membro()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int;
begin
  -- update que não muda papel nem loja: nada a checar
  if TG_OP = 'UPDATE'
     and NEW.role is not distinct from OLD.role
     and NEW.org_id is not distinct from OLD.org_id then
    return NEW;
  end if;
  if NEW.role in ('vendedor', 'motoboy') then
    perform pg_advisory_xact_lock(hashtext('limite_membros'), hashtext(NEW.org_id::text));
  end if;
  if NEW.role in ('vendedor','motoboy') and not private.permite_papel(NEW.org_id, NEW.role) then
    raise exception 'papel_nao_permitido' using detail = NEW.role;
  end if;
  if NEW.role = 'vendedor' then
    lim := private.limite_vendedores(NEW.org_id);
    if lim is not null and (
      select count(*) from public.usuario
      where org_id = NEW.org_id and role = 'vendedor' and id <> NEW.id
    ) >= lim then
      raise exception 'limite_vendedores' using detail = lim::text;
    end if;
  end if;
  return NEW;
end $$;

-- [#4] mesmo padrão para o limite de revendedoras ativas (insert/reativação).
-- (motoboys e produtos não têm limite por contagem — só booleano por plano.)
create or replace function private.checar_limite_revendedora()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int;
begin
  if NEW.ativa and (TG_OP = 'INSERT' or not coalesce(OLD.ativa, false)) then
    perform pg_advisory_xact_lock(hashtext('limite_revendedoras'), hashtext(NEW.org_id::text));
    lim := private.limite_revendedoras(NEW.org_id);
    if lim is not null and (
      select count(*) from public.revendedora
      where org_id = NEW.org_id and ativa and id <> NEW.id
    ) >= lim then
      raise exception 'limite_revendedoras' using detail = lim::text;
    end if;
  end if;
  return NEW;
end $$;

-- ============================================================ [#7] membro dentro do plano
-- [#7] o membro atual (auth.uid) ainda opera no plano efetivo da loja? Igual ao
-- gate por posição das revendedoras (0027): dono sempre; vendedor só se o plano
-- tem vendedores e ele está entre os N mais antigos (N = limite do plano);
-- motoboy só se o plano tem motoboys. Usado em registrar_venda (0042) e nas
-- atualizações de entrega do motoboy (abaixo). Os dados não são apagados.
create or replace function private.membro_no_limite()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with eu as (
    select u.id, u.org_id, u.role from public.usuario u where u.id = auth.uid()
  )
  select case
    when not exists (select 1 from eu) then false
    when (select role from eu) = 'owner' then true
    when not coalesce(private.permite_papel((select org_id from eu), (select role from eu)), false) then false
    when (select role from eu) = 'vendedor'
         and private.limite_vendedores((select org_id from eu)) is not null then
      (select id from eu) in (
        select u.id
        from public.usuario u
        left join auth.users au on au.id = u.id
        where u.org_id = (select org_id from eu) and u.role = 'vendedor'
        order by au.created_at nulls last, u.id
        limit private.limite_vendedores((select org_id from eu))
      )
    else true
  end
$$;
grant execute on function private.membro_no_limite() to authenticated;

-- [#7][#14] entrega: motoboy fora do plano não atualiza; o resto igual a 0034.
drop policy if exists entrega_update on public.entrega;
create policy entrega_update on public.entrega for update to authenticated
  using (
    org_id = private.current_org_id()
    and (
      private.current_role() = 'owner'
      or (
        (motoboy_id = (select auth.uid())
          or (private.current_role() = 'motoboy' and motoboy_id is null))
        and private.membro_no_limite()
      )
    )
  )
  with check (
    org_id = private.current_org_id()
    and (
      private.current_role() = 'owner'
      or (private.current_role() = 'motoboy'
          and (motoboy_id = (select auth.uid()) or motoboy_id is null))
    )
  );

-- [#14] motoboy só muda status, entregue_em e motoboy_id (pegar/devolver/status
-- em lib/store.ts). Taxa, endereço, venda etc. ficam com o dono.
create or replace function private.entrega_guarda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.via_api_cliente() and coalesce(private.current_role(), '') <> 'owner'
     and (to_jsonb(NEW) - array['status', 'entregue_em', 'motoboy_id'])
         is distinct from (to_jsonb(OLD) - array['status', 'entregue_em', 'motoboy_id']) then
    raise exception 'entrega_campo_bloqueado';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_entrega_guarda on public.entrega;
create trigger trg_entrega_guarda before update on public.entrega
  for each row execute function private.entrega_guarda();

-- ============================================================ [#13] papéis
-- [#13] usuario.role só aceita os papéis do app; trocar para/de 'owner' por
-- update direto é bloqueado (promover vendedor a dono / se rebaixar e perder a
-- loja). id/org_id/email do membro também não mudam pela Data API.
create or replace function private.usuario_guarda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.via_api_cliente() then
    if NEW.id is distinct from OLD.id
       or NEW.org_id is distinct from OLD.org_id
       or NEW.email is distinct from OLD.email then
      raise exception 'usuario_campo_protegido';
    end if;
    if NEW.role is distinct from OLD.role and (NEW.role = 'owner' or OLD.role = 'owner') then
      raise exception 'papel_protegido';
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_usuario_guarda on public.usuario;
create trigger trg_usuario_guarda before update on public.usuario
  for each row execute function private.usuario_guarda();

-- [#13] o dono não remove outro dono da org pela Data API.
drop policy if exists usuario_delete_owner on public.usuario;
create policy usuario_delete_owner on public.usuario
  for delete to authenticated
  using (
    org_id = private.current_org_id()
    and private.current_role() = 'owner'
    and id <> (select auth.uid())
    and role <> 'owner'
  );

-- ============================================================ [#13][#14][#15] CHECKs
-- NOT VALID + tentativa de VALIDATE: vale para todo INSERT/UPDATE daqui em
-- diante; se houver legado fora da regra, a migration não falha (fica um NOTICE).
do $$
declare
  c record;
begin
  for c in
    select * from (values
      -- [#13] papéis do app
      ('usuario',          'usuario_role_valido',            $c$role in ('owner', 'vendedor', 'motoboy')$c$),
      -- [#14] status de entrega usados pela UI (lib/types.ts StatusEntrega)
      ('entrega',          'entrega_status_valido',          $c$status in ('pendente', 'a_caminho', 'entregue')$c$),
      -- [#15] valores monetários / percentuais
      ('produto',          'produto_preco_nao_negativo',     $c$preco_venda >= 0 and custo >= 0 and (preco_comparativo is null or preco_comparativo >= 0)$c$),
      ('revendedora',      'revendedora_comissao_faixa',     $c$comissao_percent >= 0 and comissao_percent <= 100$c$),
      ('org',              'org_comissao_padrao_faixa',      $c$comissao_padrao >= 0 and comissao_padrao <= 100$c$),
      ('entrada_pendente', 'entrada_pendente_valor_positivo', $c$valor > 0$c$),
      ('entrega',          'entrega_taxa_nao_negativa',      $c$taxa >= 0$c$),
      -- [#15] limites de tamanho (texto livre vindo do cliente)
      ('venda',            'venda_canal_len',                $c$char_length(canal) <= 40$c$),
      ('usuario',          'usuario_nome_len',               $c$nome is null or char_length(nome) <= 120$c$),
      ('revendedora',      'revendedora_nome_len',           $c$char_length(nome) <= 120$c$),
      ('produto',          'produto_nome_len',               $c$char_length(nome) <= 200$c$),
      ('conversa',         'conversa_cliente_nome_len',      $c$cliente_nome is null or char_length(cliente_nome) <= 120$c$)
    ) as t(tabela, nome, expr)
  loop
    if not exists (select 1 from pg_constraint where conname = c.nome) then
      execute format('alter table public.%I add constraint %I check (%s) not valid', c.tabela, c.nome, c.expr);
    end if;
    begin
      execute format('alter table public.%I validate constraint %I', c.tabela, c.nome);
    exception when check_violation then
      raise notice '% ficou NOT VALID: há linhas legadas fora da regra em %', c.nome, c.tabela;
    end;
  end loop;
end $$;

-- ============================================================ [#18] storage
-- [#18] upload/troca/remoção de imagens só pelo DONO (antes: qualquer membro,
-- inclusive motoboy, trocava a logo da loja). A leitura pública "for select to
-- public" permitia o anon LISTAR os buckets; os buckets são public, então a
-- imagem continua servida por URL exata (/storage/v1/object/public/...) sem
-- policy de select. O dono mantém select da própria pasta (upload com upsert).
drop policy if exists "logo_leitura_publica" on storage.objects;
drop policy if exists "produto_img_leitura_publica" on storage.objects;
drop policy if exists "loja_img_select_dono" on storage.objects;
create policy "loja_img_select_dono" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('lojas', 'produtos')
    and (storage.foldername(name))[1] = private.current_org_id()::text
    and private.current_role() = 'owner'
  );

do $$
declare
  b text;
  pref text;
begin
  foreach b in array array['lojas', 'produtos'] loop
    pref := case b when 'lojas' then 'logo' else 'produto_img' end;
    execute format('drop policy if exists %I on storage.objects', pref || '_insert_org');
    execute format('drop policy if exists %I on storage.objects', pref || '_update_org');
    execute format('drop policy if exists %I on storage.objects', pref || '_delete_org');
    execute format($p$
      create policy %I on storage.objects for insert to authenticated
        with check (bucket_id = %L
          and (storage.foldername(name))[1] = private.current_org_id()::text
          and private.current_role() = 'owner')$p$, pref || '_insert_org', b);
    execute format($p$
      create policy %I on storage.objects for update to authenticated
        using (bucket_id = %L
          and (storage.foldername(name))[1] = private.current_org_id()::text
          and private.current_role() = 'owner')
        with check (bucket_id = %L
          and (storage.foldername(name))[1] = private.current_org_id()::text
          and private.current_role() = 'owner')$p$, pref || '_update_org', b, b);
    execute format($p$
      create policy %I on storage.objects for delete to authenticated
        using (bucket_id = %L
          and (storage.foldername(name))[1] = private.current_org_id()::text
          and private.current_role() = 'owner')$p$, pref || '_delete_org', b);
  end loop;
end $$;

-- [#18] reforça tipo/tamanho no bucket (0028 já fazia; idempotente).
update storage.buckets
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  where id in ('lojas', 'produtos');
