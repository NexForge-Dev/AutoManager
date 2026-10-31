import { NextResponse } from "next/server";
import { enviarMetricas, registrarEvento } from "@/lib/metricas/servidor";
import { donoDaOrg } from "@/lib/donoDaOrg";
import { PLANOS, type PlanoId } from "@/lib/plans";
import {
  adminClient,
  appUrl,
  assinaturaVivaDaOrg,
  clienteDaOrg,
  posSincronizar,
  precoDoPlano,
  semIdempotencia,
  stripe,
  supabaseBillingStore,
} from "@/lib/stripe";
import { tratarEventoStripe } from "@/lib/billing/stripeSync";

export const runtime = "nodejs";

// Assina ou troca o plano da loja no Stripe. Só o DONO pode.
//  - sem assinatura Stripe viva: cria uma Checkout Session e devolve { url } p/ redirecionar.
//  - já assina: troca o preço da assinatura existente (proporcional na próxima fatura)
//    e devolve { atualizado: true } - nunca cria uma segunda cobrança.
export async function POST(req: Request) {
  const dono = await donoDaOrg();
  if (!dono) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const { plano } = (await req.json().catch(() => ({}))) as { plano?: PlanoId };
  if (!plano || !(plano in PLANOS)) return NextResponse.json({ erro: "Plano inválido" }, { status: 400 });
  if (!dono.email) return NextResponse.json({ erro: "Sua conta não tem e-mail para o pagamento." }, { status: 400 });

  try {
    const admin = adminClient();
    const preco = await precoDoPlano(plano);
    registrarEvento("plan_selected", dono.orgId, { plan: plano, billing_period: "month" });

    const viva = await assinaturaVivaDaOrg(admin, dono.orgId);
    if (viva) {
      const item = viva.items.data[0];
      if (item?.price.id === preco.id) {
        await enviarMetricas();
        return NextResponse.json({ atualizado: true, plano });
      }
      await stripe().subscriptions.update(viva.id, {
        items: [{ id: item.id, price: preco.id }],
        proration_behavior: "create_prorations",
        metadata: { org_id: dono.orgId, plano },
      });
      // aplica já (o webhook customer.subscription.updated confirma depois, idempotente)
      const r = await tratarEventoStripe(
        { id: `troca:${viva.id}:${preco.id}`, type: "customer.subscription.updated", data: { object: { id: viva.id } } } as any,
        semIdempotencia(supabaseBillingStore(admin)),
        (id) => stripe().subscriptions.retrieve(id)
      );
      await posSincronizar(r, `troca:${viva.id}:${preco.id}`);
      await enviarMetricas();
      return NextResponse.json({ atualizado: true, plano: r.plano ?? plano });
    }

    const customer = await clienteDaOrg(admin, dono.orgId, dono.email);
    const base = appUrl();
    const sessao = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: dono.orgId,
      line_items: [{ price: preco.id, quantity: 1 }],
      metadata: { org_id: dono.orgId, plano },
      subscription_data: { metadata: { org_id: dono.orgId, plano } },
      locale: "pt-BR",
      allow_promotion_codes: true,
      success_url: `${base}/configuracoes/plano?checkout=sucesso&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/planos?checkout=cancelado`,
    });
    if (!sessao.url) return NextResponse.json({ erro: "O Stripe não retornou o link de pagamento." }, { status: 502 });

    registrarEvento("checkout_started", dono.orgId, { plan: plano, billing_period: "month" });
    await enviarMetricas();
    return NextResponse.json({ url: sessao.url });
  } catch (e) {
    console.error("Falha ao iniciar assinatura Stripe", e);
    return NextResponse.json({ erro: "Não foi possível iniciar o pagamento agora. Tente novamente." }, { status: 502 });
  }
}
