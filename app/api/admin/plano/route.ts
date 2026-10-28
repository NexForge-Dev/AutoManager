import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { ehSuperadminUser } from "@/lib/admin";
import { PLANOS, type PlanoId } from "@/lib/plans";
import { registrarAdminLog } from "@/lib/adminAudit";

// Troca MANUAL de plano de uma loja pelo super-admin (cortesia / suporte).
// Altera direto a tabela `assinatura` via service_role (ignora RLS), SÓ depois
// de confirmar que quem chama é o super-admin. Não cria cobrança no Mercado Pago.

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

export async function POST(req: Request) {
  const su = await exigirSuperadmin();
  if (!su) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const { orgId, plano } = (await req.json().catch(() => ({}))) as {
    orgId?: string;
    plano?: PlanoId;
  };
  if (!orgId || !plano || !["ambulante", "solo", "equipe", "expansao"].includes(plano))
    return NextResponse.json({ erro: "Dados inválidos" }, { status: 400 });

  const inicio = new Date();

  const a = admin();
  // plano anterior (p/ auditoria) antes de sobrescrever
  const { data: antes } = await a.from("assinatura").select("plano").eq("org_id", orgId).maybeSingle();

  const { data, error } = await a
    .from("assinatura")
    .update({
      plano,
      status: "active",
      preco_centavos: PLANOS[plano].precoCentavos,
      periodo: "mensal",
      trial_ate: null, // encerra o trial ao definir um plano manualmente
      data_inicio: inicio.toISOString(),
      // cortesia/suporte: sem vencimento (data_fim null). Com data_fim, o plano
      // cairia no piso ao vencer (private.plano_efetivo, 0035) sem cobrança no MP.
      data_fim: null,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .select("org_id")
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Loja não encontrada" }, { status: 404 });

  const { data: orgRow } = await a.from("org").select("nome").eq("id", orgId).maybeSingle();
  await registrarAdminLog(a, {
    actorEmail: (su.email ?? "").trim().toLowerCase(),
    acao: "mudar_plano",
    alvoOrgId: orgId,
    alvoDescricao: orgRow?.nome ?? "loja",
    detalhe: { de: antes?.plano ?? null, para: plano },
  });

  return NextResponse.json({ ok: true, plano });
}
