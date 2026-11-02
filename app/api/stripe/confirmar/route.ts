import { NextResponse } from "next/server";
import { enviarMetricas } from "@/lib/metricas/servidor";
import { donoDaOrg } from "@/lib/donoDaOrg";
import { adminClient, lerAssinatura, posSincronizar, semIdempotencia, stripe, supabaseBillingStore } from "@/lib/stripe";
import { tratarEventoStripe } from "@/lib/billing/stripeSync";

export const runtime = "nodejs";

// Chamado pela tela de assinatura quando o dono volta do Checkout do Stripe.
// Confirma o status na hora (sem depender só do webhook) e aplica o plano.
// Valida que a sessão pertence à org do próprio dono antes de aplicar.
export async function POST(req: Request) {
  const dono = await donoDaOrg();
  if (!dono) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const { session_id } = (await req.json().catch(() => ({}))) as { session_id?: string };
  if (!session_id || !session_id.startsWith("cs_")) return NextResponse.json({ erro: "Sessão inválida" }, { status: 400 });

  try {
    const sessao = await stripe().checkout.sessions.retrieve(session_id);
    // segurança: a sessão precisa ser da org de quem está logado
    if (sessao.client_reference_id !== dono.orgId)
      return NextResponse.json({ erro: "Pagamento não pertence a esta loja" }, { status: 403 });

    const r = await tratarEventoStripe(
      { id: `confirmar:${sessao.id}`, type: "checkout.session.completed", data: { object: sessao } } as any,
      semIdempotencia(supabaseBillingStore(adminClient())),
      lerAssinatura
    );
    await posSincronizar(r, sessao.id);
    await enviarMetricas();
    return NextResponse.json({ resultado: r.resultado, status: r.status ?? null, plano: r.status === "active" ? r.plano : null });
  } catch (e) {
    console.error("Falha ao confirmar checkout Stripe", e);
    return NextResponse.json({ erro: "Não foi possível confirmar o pagamento agora." }, { status: 502 });
  }
}
