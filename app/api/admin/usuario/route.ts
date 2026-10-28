import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { ehSuperadminUser } from "@/lib/admin";
import { registrarAdminLog } from "@/lib/adminAudit";

// Moderação de contas pelo super-admin (cortesia / abuso):
//   - desativar : suspende a loja (bloqueia login de todos os usuários dela). Reversível.
//   - banir     : bloqueia login (igual desativar no efeito, rótulo punitivo).  Reversível.
//   - reativar  : reabre o acesso (remove o ban) de uma loja desativada/banida.
//   - deletar   : APAGA a loja, todos os dados e as contas de auth. Irreversível.
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
  const sb = createServer();
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
  if (!orgId || !["desativar", "banir", "reativar", "deletar"].includes(acao ?? ""))
    return NextResponse.json({ erro: "Dados inválidos" }, { status: 400 });

  const a = admin();

  // usuários da loja (id = id do auth.users). Serve para banir/deletar as contas.
  const { data: usuarios, error: erroUsuarios } = await a
    .from("usuario")
    .select("id, email")
    .eq("org_id", orgId);
  if (erroUsuarios)
    return NextResponse.json({ erro: erroUsuarios.message }, { status: 500 });

  // trava de segurança: nunca agir sobre a própria conta do super-admin
  const ids = (usuarios ?? []).map((u) => u.id);
  if (ids.includes(su.id))
    return NextResponse.json({ erro: "Não é possível moderar a conta de administração." }, { status: 400 });
  for (const id of ids) {
    const { data: au, error: eAu } = await a.auth.admin.getUserById(id);
    if (eAu) return NextResponse.json({ erro: eAu.message }, { status: 500 });
    if (ehSuperadminUser(au.user))
      return NextResponse.json({ erro: "Não é possível moderar a conta de administração." }, { status: 400 });
  }

  // descrição da loja p/ a trilha de auditoria (nome + e-mail do dono).
  const { data: orgRow } = await a.from("org").select("nome").eq("id", orgId).maybeSingle();
  const donoEmail = (usuarios ?? [])[0]?.email ?? null;
  const alvoDescricao = `${orgRow?.nome ?? "loja"}${donoEmail ? ` (${donoEmail})` : ""}`;
  const actorEmail = (su.email ?? "").trim().toLowerCase();

  try {
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
        detalhe: { usuarios_removidos: ids.length },
      });
      return NextResponse.json({ ok: true, acao });
    }

    // bloquear (desativar/banir) ou liberar (reativar) o login de todos os usuários
    const banir = acao === "desativar" || acao === "banir";
    for (const id of ids) {
      const { error: e } = await a.auth.admin.updateUserById(id, {
        ban_duration: banir ? BAN_LONGO : "none",
      });
      if (e) console.error("Falha ao alterar ban do usuário", id, e.message);
    }

    const acesso = acao === "banir" ? "banido" : acao === "desativar" ? "desativado" : "ativo";
    const { error } = await a.from("org").update({ acesso }).eq("id", orgId);
    if (error) throw new Error(error.message);

    await registrarAdminLog(a, {
      actorEmail,
      acao: acao!,
      alvoOrgId: orgId,
      alvoDescricao,
      detalhe: { acesso, usuarios_afetados: ids.length },
    });

    return NextResponse.json({ ok: true, acao, acesso });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
