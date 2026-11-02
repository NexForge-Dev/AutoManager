import { NextResponse } from "next/server";
import { enviarMetricas } from "@/lib/metricas/servidor";
import { adminClient, posSincronizar, stripe, supabaseBillingStore } from "@/lib/stripe";
import { tratarEventoStripe } from "@/lib/billing/stripeSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Webhook do Stripe: assinatura verificada (STRIPE_WEBHOOK_SECRET), idempotente.
// Configure no Stripe o endpoint <NEXT_PUBLIC_APP_URL>/api/stripe/webhook com os eventos:
//   checkout.session.completed, checkout.session.async_payment_succeeded,
//   customer.subscription.created/updated/deleted/paused/resumed,
//   invoice.paid, invoice.payment_failed
// Sem segredo, falha fechado (503) em qualquer ambiente: nunca aceita evento não assinado.
// Erros reais (API do Stripe / banco) respondem 500 -> o Stripe reenvia (handlers idempotentes).
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_WEBHOOK_SECRET/STRIPE_SECRET_KEY não configurados - webhook rejeitado");
    return NextResponse.json({ erro: "webhook nao configurado" }, { status: 503 });
  }
  const assinatura = req.headers.get("stripe-signature");
  if (!assinatura) return NextResponse.json({ erro: "assinatura ausente" }, { status: 400 });

  const payload = await req.text();
  let evento;
  try {
    evento = await stripe().webhooks.constructEventAsync(payload, assinatura, secret);
  } catch {
    return NextResponse.json({ erro: "assinatura invalida" }, { status: 400 });
  }

  try {
    const r = await tratarEventoStripe(
      evento,
      supabaseBillingStore(adminClient()),
      (id) => stripe().subscriptions.retrieve(id),
      (res) => posSincronizar(res, evento.id, true)
    );
    await enviarMetricas();
    return NextResponse.json({ recebido: true, resultado: r.resultado });
  } catch (e) {
    console.error("Webhook Stripe falhou", evento.type, evento.id, e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: "falha ao processar" }, { status: 500 });
  }
}
