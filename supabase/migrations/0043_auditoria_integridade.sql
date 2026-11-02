-- ============================================================================
-- Auditoria 02/11/2026 — integridade entre lojas (cross-tenant) e anti-spam.
-- Aplicar DEPOIS de 0041/0042 (usa private.via_api_cliente da 0041).
-- Idempotente: create or replace / drop ... if exists / checagem em pg_catalog.
--
--  [A1] produto_variacao: org_id da variação precisa ser o mesmo do produto.
--       As policies só olhavam o org_id da PRÓPRIA linha: um dono inseria uma
--       variação com o org_id dele apontando para o produto_id de OUTRA loja (os
--       ids saem na vitrine pública). A variação aparecia na vitrine e no
--       catálogo da revendedora da vítima, e as vendas do produto passavam a
--       exigir "escolha a variação" (loja_publica, registrar_venda e
--       recalcular_estoque_produto filtram variação só por produto_id).
--  [A2] entrega: motoboy_id e venda_id precisam ser da mesma loja da entrega.
--  [A3] chamado (suporte): visitante anônimo da vitrine (login anônimo do chat
--       tem papel authenticated) conseguia abrir chamados sem limite; agora só
--       contas reais, com tamanho máximo e tipo válido.
--  [A4] chat da vitrine: limite de conversas novas por visitante e de mensagens
--       por minuto em cada conversa (antes: flood ilimitado no inbox da loja).
--  [A5] CHECKs de formato/tamanho: slug da vitrine e contas a pagar.
-- ============================================================================

-- ============================================================ [A1] variação x produto
-- limpa vínculos cruzados já existentes (só possíveis pelo furo acima): a
-- variação "intrusa" não pertence à loja dona do produto.
do $$
declare n int;
begin
  delete from public.produto_variacao v
  using public.produto p
  where p.id = v.produto_id and p.org_id <> v.org_id;
  get diagnostics n = row_count;
  if n > 0 then
    raise notice '[A1] % variação(ões) com org_id diferente do produto foram removidas', n;
  end if;
end $$;

create or replace function private.variacao_mesma_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.produto p where p.id = NEW.produto_id and p.org_id = NEW.org_id
  ) then
    raise exception 'produto_invalido';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_variacao_mesma_org on public.produto_variacao;
create trigger trg_variacao_mesma_org before insert or update of produto_id, org_id on public.produto_variacao
  for each row execute function private.variacao_mesma_org();

-- ============================================================ [A2] entrega x loja
create or replace function private.entrega_mesma_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.motoboy_id is not null and not exists (
    select 1 from public.usuario u where u.id = NEW.motoboy_id and u.org_id = NEW.org_id
  ) then
    raise exception 'motoboy_invalido';
  end if;
  if NEW.venda_id is not null and not exists (
    select 1 from public.venda s where s.id = NEW.venda_id and s.org_id = NEW.org_id
  ) then
    raise exception 'venda_invalida';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_entrega_mesma_org on public.entrega;
create trigger trg_entrega_mesma_org before insert or update of motoboy_id, venda_id, org_id on public.entrega
  for each row execute function private.entrega_mesma_org();

-- ============================================================ [A3] chamados
drop policy if exists chamado_insert on public.chamado;
create policy chamado_insert on public.chamado for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and (org_id is null or org_id = private.current_org_id())
    and status = 'aberto'
    and resolved_at is null
  );

-- ============================================================ [A4] anti-flood do chat
-- Conta só o que vem do cliente pela Data API (via_api_cliente): RPCs/triggers
-- definer e a service_role não entram no limite. Os guardas são INVOKER (precisam
-- ver quem chamou); a contagem é DEFINER (enxerga todas as linhas, sem RLS).
create or replace function private.chat_limite_conversa_checar(p_cliente uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cliente is not null and (
    select count(*) from public.conversa c
    where c.cliente_id = p_cliente and c.criada_em > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'chat_limite';
  end if;
end $$;

create or replace function private.chat_limite_conversa_guarda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.via_api_cliente() then
    perform pg_advisory_xact_lock(hashtext('chat_conversa'), hashtext(coalesce(NEW.cliente_id::text, '')));
    perform private.chat_limite_conversa_checar(NEW.cliente_id);
  end if;
  return NEW;
end $$;
drop trigger if exists trg_chat_limite_conversa on public.conversa;
create trigger trg_chat_limite_conversa before insert on public.conversa
  for each row execute function private.chat_limite_conversa_guarda();

create or replace function private.chat_limite_mensagem_checar(p_conversa uuid, p_autor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.mensagem m
    where m.conversa_id = p_conversa and m.autor_id = p_autor
      and m.criada_em > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'chat_limite';
  end if;
end $$;

create or replace function private.chat_limite_mensagem_guarda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.via_api_cliente() then
    -- carimbo do servidor: o limite e as "não lidas" do inbox dependem dele
    NEW.criada_em := now();
    perform pg_advisory_xact_lock(hashtext('chat_mensagem'), hashtext(NEW.conversa_id::text));
    perform private.chat_limite_mensagem_checar(NEW.conversa_id, NEW.autor_id);
  end if;
  return NEW;
end $$;
drop trigger if exists trg_chat_limite_mensagem on public.mensagem;
create trigger trg_chat_limite_mensagem before insert on public.mensagem
  for each row execute function private.chat_limite_mensagem_guarda();

revoke all on function private.chat_limite_conversa_checar(uuid) from public;
revoke all on function private.chat_limite_mensagem_checar(uuid, uuid) from public;
grant execute on function private.chat_limite_conversa_checar(uuid) to anon, authenticated;
grant execute on function private.chat_limite_mensagem_checar(uuid, uuid) to anon, authenticated;

-- ============================================================ [A5] CHECKs
do $$
declare
  c record;
begin
  for c in
    select * from (values
      -- slug vai na URL pública /loja/<slug> (o app gera minúsculas, dígitos e hífens)
      ('org',         'org_slug_formato',          $c$slug is null or (slug ~ '^[a-z0-9]+(-+[a-z0-9]+)*$' and char_length(slug) <= 60)$c$),
      ('org',         'org_nome_len',              $c$char_length(nome) <= 120$c$),
      ('conta_pagar', 'conta_pagar_valor_positivo', $c$valor > 0$c$),
      ('conta_pagar', 'conta_pagar_status_valido',  $c$status in ('pendente', 'paga')$c$),
      ('conta_pagar', 'conta_pagar_descricao_len',  $c$char_length(descricao) between 1 and 200$c$),
      ('chamado',     'chamado_tipo_valido',        $c$tipo in ('erro', 'duvida', 'sugestao')$c$),
      ('chamado',     'chamado_status_valido',      $c$status in ('aberto', 'resolvido')$c$),
      ('chamado',     'chamado_assunto_len',        $c$char_length(assunto) between 1 and 200$c$),
      ('chamado',     'chamado_mensagem_len',       $c$char_length(mensagem) between 1 and 4000$c$),
      -- canais do app (lib/types.ts Canal); as RPCs de venda aceitavam qualquer texto
      ('venda',       'venda_canal_valido',         $c$canal in ('loja', 'whatsapp', 'instagram')$c$)
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

-- ============================================================ [A6] privilégios residuais
-- Os grants padrão do Supabase dão TRUNCATE/TRIGGER/REFERENCES a anon e
-- authenticated em toda tabela nova. TRUNCATE ignora a RLS; a Data API não o
-- expõe, mas não há motivo para o privilégio existir (defesa em profundidade).
do $$
declare t text;
begin
  for t in select c.relname from pg_class c
           where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t);
  end loop;
end $$;
