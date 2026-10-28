import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { PLANOS, type PlanoId } from "@/lib/plans";

// Define o plano escolhido no onboarding dentro do TRIAL de 1 mês (grátis) — depois
// começa a cobrar (o ciclo pago é configurado no Mercado Pago ao fim do trial).
// Só o DONO (owner) da org pode definir, e a escrita usa service_role (a tabela
// `assinatura` não é gravável via RLS pelo usuário comum).
//
// Anti-abuso: o trial é ÚNICO por loja. Ele nasce junto com a org (trigger
// criar_assinatura_org, 1 mês) e esta rota só troca o PLANO escolhido — nunca
// estende/reinicia o trial_ate. Só inicia um trial se a loja nunca teve um
// (trial_usado = false e sem assinatura paga). Loja que já assinou/pagou,
// cancelou ou está inadimplente não volta para trial por aqui.

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function donoDaOrg() {
  const sb = createServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: eu } = await sb
    .from("usuario")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu || eu.role !== "owner") return null;
  return { orgId: eu.org_id as string };
}

function umMesDepois(de: Date): Date {
  const d = new Date(de);
  d.setMonth(d.getMonth() + 1); // 1 mês grátis
  return d;
}

export async function POST(req: Request) {
  const dono = await donoDaOrg();
  if (!dono) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const { plano } = (await req.json().catch(() => ({}))) as { plano?: PlanoId };
  if (!plano || !["ambulante", "solo", "equipe", "expansao"].includes(plano))
    return NextResponse.json({ erro: "Plano inválido" }, { status: 400 });

  const sb = admin();
  const agora = new Date();

  const { data: atual, error: eSel } = await sb
    .from("assinatura")
    .select("status, trial_ate, trial_usado, provider_assinatura_id")
    .eq("org_id", dono.orgId)
    .maybeSingle();
  if (eSel) return NextResponse.json({ erro: eSel.message }, { status: 500 });

  // sem linha (org antiga sem assinatura): inicia o trial único agora.
  if (!atual) {
    const { error: eIns } = await sb.from("assinatura").insert({
      org_id: dono.orgId,
      plano,
      status: "trialing",
      preco_centavos: PLANOS[plano].precoCentavos,
      periodo: "mensal",
      trial_ate: umMesDepois(agora).toISOString(),
      trial_usado: true,
      data_inicio: agora.toISOString(),
      data_fim: null,
    });
    if (eIns) return NextResponse.json({ erro: eIns.message }, { status: 500 });
    return NextResponse.json({ ok: true, plano });
  }

  // já tem/teve assinatura paga (ou está cancelada/inadimplente): não é onboarding.
  if (atual.status !== "trialing" || atual.provider_assinatura_id)
    return NextResponse.json(
      { erro: "Sua loja já tem uma assinatura. Troque de plano em Configurações › Plano." },
      { status: 409 }
    );

  // trialing: troca só o plano escolhido. O trial_ate é mantido (não estende).
  // Exceção: nunca houve trial de fato (trial_usado = false e sem trial_ate) -> inicia.
  const iniciarTrial = !atual.trial_usado && !atual.trial_ate;
  const dados: Record<string, unknown> = {
    plano,
    preco_centavos: PLANOS[plano].precoCentavos,
    periodo: "mensal",
    updated_at: agora.toISOString(),
  };
  if (iniciarTrial) {
    dados.trial_ate = umMesDepois(agora).toISOString();
    dados.trial_usado = true;
    dados.data_inicio = agora.toISOString();
    dados.data_fim = null;
  }

  const { error } = await sb.from("assinatura").update(dados).eq("org_id", dono.orgId);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, plano });
}
