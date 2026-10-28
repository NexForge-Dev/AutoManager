import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { ehSuperadminUser } from "@/lib/admin";

// Trilha de auditoria do super-admin (tabela admin_log, migration 0032).
// Service role após confirmar o super-admin pela sessão.

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

export async function GET() {
  const su = await exigirSuperadmin();
  if (!su) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const { data, error } = await admin()
    .from("admin_log")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const logs = (data ?? []).map((l) => ({
    id: l.id,
    actorEmail: l.actor_email,
    acao: l.acao,
    alvoOrgId: l.alvo_org_id,
    alvoDescricao: l.alvo_descricao,
    detalhe: l.detalhe,
    criadoEm: new Date(l.criado_em).getTime(),
  }));
  return NextResponse.json({ logs });
}
