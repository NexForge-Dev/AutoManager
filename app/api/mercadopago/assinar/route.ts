import { NextResponse } from "next/server";
import { enviarMetricas, registrarEvento } from "@/lib/metricas/servidor";
import { createClient as createServer } from "@/lib/supabase/server";
import { criarPreapproval } from "@/lib/mercadopago";
import type { PlanoId } from "@/lib/plans";

// Inicia a assinatura de um plano no Mercado Pago.
// Só o DONO (owner) da org pode assinar. Devolve { init_point } para redirecionar.

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
  return { userId: user.id, orgId: eu.org_id as string, email: user.email ?? "" };
}

export async function POST(req: Request) {
  const dono = await donoDaOrg();
  if (!dono) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const { plano } = (await req.json().catch(() => ({}))) as { plano?: PlanoId };
  if (!plano || !["ambulante", "solo", "equipe", "expansao"].includes(plano))
    return NextResponse.json({ erro: "Plano inválido" }, { status: 400 });

  if (!dono.email)
    return NextResponse.json(
      { erro: "Sua conta não tem e-mail para o pagamento." },
      { status: 400 }
    );

  try {
    const pre = await criarPreapproval({ plano, email: dono.email, orgId: dono.orgId });
    if (!pre.init_point)
      return NextResponse.json({ erro: "Mercado Pago não retornou o link de pagamento." }, { status: 502 });
    registrarEvento("plan_selected", dono.orgId, { plan: plano, billing_period: "month" });
    registrarEvento("checkout_started", dono.orgId, { plan: plano, billing_period: "month" });
    await enviarMetricas();
    return NextResponse.json({ init_point: pre.init_point, id: pre.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao iniciar pagamento";
    return NextResponse.json({ erro: msg }, { status: 502 });
  }
}
