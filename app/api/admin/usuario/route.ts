import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { ehSuperadminUser } from "@/lib/admin";
import { registrarAdminLog } from "@/lib/adminAudit";
import { assinaturaVivaDaOrg, stripe } from "@/lib/stripe";
import { erroInterno } from "@/lib/erroApi";
import { uuidValido } from "@/lib/validacao";

// Moderação de contas pelo super-admin (cortesia / abuso):
//   - desativar : suspende a loja (bloqueia login de todos os usuários dela, inclusive
//                 das revendedoras, e encerra as sessões abertas). Reversível.
//   - banir     : bloqueia login (igual desativar no efeito, rótulo punitivo).  Reversível.
//   - reativar  : reabre o acesso (remove o ban) de uma loja desativada/banida.
//   - deletar   : APAGA a loja, todos os dados e as contas de auth. Irreversível.
// A assinatura no Stripe é cancelada (deletar/banir), pausada (desativar) ou retomada (reativar).
// Tudo via service_role (ignora RLS), só depois de confirmar o super-admin.

const BAN_LONGO = "876000h"; // ~100 anos = bloqueado por tempo indeterminado

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function exigirSuperadmin() {
  const sb = await createServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  // papel no app_metadata (só a service_role grava) - não mais pelo e-mail
  if (!ehSuperadminUser(user)) return null;
  return user;
}

type Acao = "desativar" | "banir" | "reativar" | "deletar";

export async function POST(req: Request) {
  const su = await exigirSuperadmin();
  if (!su) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const { orgId, acao } = (await req.json().catch(() => ({}))) as {
    orgId?: string;
    acao?: Acao;
  };
  if (!uuidValido(orgId) || !["desativar", "banir", "reativar", "deletar"].includes(acao ?? ""))
    return NextResponse.json({ erro: "Dados inválidos" }, { status: 400 });

  const a = admin();

  // usuários da loja (id = id do auth.users). Serve para banir/deletar as contas.
  const { data: usuarios, error: erroUsuarios } = await a
    .from("usuario")
    .select("id, email")
    .eq("org_id", orgId);
  if (erroUsuarios) return erroInterno("admin/usuario", erroUsuarios);

  // logins das revendedoras da loja (não têm linha em public.usuario): o ban da
  // loja também vale para elas, senão seguiam vendendo pelo /revenda.
  const { data: revs, error: erroRevs } = await a
    .from("revendedora")
    .select("user_id")
    .eq("org_id", orgId)
    .not("user_id", "is", null);
  if (erroRevs) return erroInterno("admin/usuario", erroRevs);

  // trava de segurança: nunca agir sobre a própria conta do super-admin
  const idsMembros = (usuarios ?? []).map((u) => u.id);
  const ids = [...new Set([...idsMembros, ...(revs ?? []).map((r) => r.user_id as string)])];
  if (ids.includes(su.id))
    return NextResponse.json({ erro: "Não é possível moderar a conta de administração." }, { status: 400 });
  for (const id of ids) {
    const { data: au, error: eAu } = await a.auth.admin.getUserById(id);
    if (eAu) return erroInterno("admin/usuario", eAu);
    if (ehSuperadminUser(au.user))
      return NextResponse.json({ erro: "Não é possível moderar a conta de administração." }, { status: 400 });
  }

  // descrição da loja p/ a trilha de auditoria (nome + e-mail do dono).
  const { data: orgRow } = await a.from("org").select("nome").eq("id", orgId).maybeSingle();
  const donoEmail = (usuarios ?? [])[0]?.email ?? null;
  const alvoDescricao = `${orgRow?.nome ?? "loja"}${donoEmail ? ` (${donoEmail})` : ""}`;
  const actorEmail = (su.email ?? "").trim().toLowerCase();

  try {
    // Cobrança no Stripe acompanha a moderação, para não cobrar loja sem acesso:
    //   deletar/banir -> cancela a assinatura; desativar -> pausa a cobrança;
    //   reativar -> retoma a cobrança pausada. Falha aqui aborta a ação (melhor
    //   não deletar do que deixar o cartão sendo cobrado sem a loja existir).
    const viva = await assinaturaVivaDaOrg(a, orgId);
    if (viva) {
      if (acao === "deletar" || acao === "banir") await stripe().subscriptions.cancel(viva.id);
      else if (acao === "desativar") await stripe().subscriptions.update(viva.id, { pause_collection: { behavior: "void" } });
      else if (acao === "reativar" && viva.pause_collection) await stripe().subscriptions.update(viva.id, { pause_collection: null });
    }

    if (acao === "deletar") {
      // apaga a org -> cascata remove todos os dados e as linhas de public.usuario.
      const { error } = await a.from("org").delete().eq("id", orgId);
      if (error) throw new Error(error.message);
      // remove as contas de autenticação (não saem na cascata da org).
      for (const id of ids) {
        const { error: e } = await a.auth.admin.deleteUser(id);
        if (e) console.error("Falha ao deletar auth user", id, e.message);
      }
      await registrarAdminLog(a, {
        actorEmail,
        acao: "deletar",
        alvoOrgId: orgId,
        alvoDescricao,
        detalhe: { usuarios_removidos: ids.length, revendedoras: ids.length - idsMembros.length },
      });
      return NextResponse.json({ ok: true, acao });
    }

    // bloquear (desativar/banir) ou liberar (reativar) o login de todos os usuários
    // da loja — membros e revendedoras
    const banir = acao === "desativar" || acao === "banir";
    for (const id of ids) {
      const { error: e } = await a.auth.admin.updateUserById(id, {
        ban_duration: banir ? BAN_LONGO : "none",
      });
      if (e) console.error("Falha ao alterar ban do usuário", id, e.message);
    }

    // org.acesso corta na hora o que o ban não corta: o banco só libera dados de
    // loja 'ativo' (current_org_id, vitrine e RPCs das revendedoras — 0041/0042).
    const acesso = acao === "banir" ? "banido" : acao === "desativar" ? "desativado" : "ativo";
    const { error } = await a.from("org").update({ acesso }).eq("id", orgId);
    if (error) throw new Error(error.message);

    // o ban não derruba sessões abertas: apaga os refresh tokens (0042). Sem a
    // RPC (banco antigo) segue — o JWT expira sozinho e org.acesso já bloqueia.
    if (banir && ids.length > 0) {
      const { error: eSess } = await a.rpc("admin_encerrar_sessoes", { p_usuarios: ids });
      if (eSess) console.error("Falha ao encerrar sessões da loja", orgId, eSess.message);
    }

    await registrarAdminLog(a, {
      actorEmail,
      acao: acao!,
      alvoOrgId: orgId,
      alvoDescricao,
      detalhe: { acesso, usuarios_afetados: ids.length, revendedoras: ids.length - idsMembros.length },
    });

    return NextResponse.json({ ok: true, acao, acesso });
  } catch (e) {
    return erroInterno("admin/usuario", e, "Não foi possível concluir a moderação agora. Tente novamente.");
  }
}
