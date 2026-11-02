import { NextResponse } from "next/server";
import { enviarMetricas, registrarEvento } from "@/lib/metricas/servidor";
import { donoDaOrg } from "@/lib/donoDaOrg";
import { planoValido } from "@/lib/plans";
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
import { tratarEventoStripe, trialEndParaCheckout } from "@/lib/billing/stripeSync";

export const runtime = "nodejs";

const VIVA = ["active", "trialing", "past_due", "unpaid", "paused"];

// Assina ou troca o plano da loja no Stripe. Só o DONO pode.
//  - sem assinatura Stripe viva: cria uma Checkout Session e devolve { url } p/ redirecionar.
//  - já assina: troca o preço da assinatura existente e cobra a diferença NA HORA; o plano
//    novo só vale depois que essa fatura é paga (pending update) - nunca cria 2ª cobrança.
export async function POST(req: Request) {
  const dono = await donoDaOrg();
  if (!dono) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const { plano } = ((await req.json().catch(() => ({}))) ?? {}) as { plano?: unknown };
  if (!planoValido(plano)) return NextResponse.json({ erro: "Plano inválido" }, { status: 400 });
  if (!dono.email) return NextResponse.json({ erro: "Sua conta não tem e-mail para o pagamento." }, { status: 400 });

  try {
    const admin = adminClient();

    // assinatura antiga do Mercado Pago ainda ativa: assinar no Stripe cobraria em dobro
    const { data: atual } = await admin
      .from("assinatura")
      .select("provider, provider_assinatura_id, status, trial_ate")
      .eq("org_id", dono.orgId)
      .maybeSingle();
    if (atual?.provider === "mercadopago" && atual.provider_assinatura_id && atual.status !== "canceled")
      return NextResponse.json(
        {
          erro:
            "Sua loja ainda tem uma assinatura ativa no Mercado Pago. Cancele-a no app do Mercado Pago " +
            "(Assinaturas) ou fale com o suporte antes de assinar pelo novo meio de pagamento.",
        },
        { status: 409 }
      );

    const preco = await precoDoPlano(plano);
    registrarEvento("plan_selected", dono.orgId, { plan: plano, billing_period: "month" });

    const customer = await clienteDaOrg(admin, dono.orgId, dono.email);
    // fonte da verdade é o Stripe: pega também assinatura criada por outra aba/sessão
    // que o webhook ainda não gravou no banco
    let viva = await assinaturaVivaDaOrg(admin, dono.orgId);
    if (!viva) {
      const { data } = await stripe().subscriptions.list({ customer, status: "all", limit: 10 });
      viva = data.find((s) => VIVA.includes(s.status)) ?? null;
    }

    if (viva) {
      if (viva.status !== "active" && viva.status !== "trialing")
        return NextResponse.json(
          { erro: "Há um pagamento pendente na sua assinatura. Regularize em Gerenciar pagamento antes de trocar de plano.", portal: true },
          { status: 409 }
        );
      const item = viva.items.data[0];
      if (item?.price.id === preco.id) {
        await enviarMetricas();
        return NextResponse.json({ atualizado: true, plano });
      }
      // always_invoice cobra a diferença agora; pending_if_incomplete só aplica a troca
      // quando essa cobrança é paga (sem isso o upgrade sairia de graça até a renovação).
      const atualizada = await stripe().subscriptions.update(viva.id, {
        items: [{ id: item.id, price: preco.id }],
        proration_behavior: "always_invoice",
        payment_behavior: "pending_if_incomplete",
      });
      if (atualizada.pending_update) {
        await enviarMetricas();
        return NextResponse.json(
          { erro: "Não conseguimos cobrar a diferença do novo plano. Atualize o cartão em Gerenciar pagamento e tente de novo.", portal: true },
          { status: 402 }
        );
      }
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

    // expira checkouts abertos anteriores (outra aba / link antigo) para não virar 2ª assinatura
    const abertas = await stripe().checkout.sessions.list({ customer, status: "open", limit: 20 });
    for (const s of abertas.data) await stripe().checkout.sessions.expire(s.id).catch(() => {});

    const base = appUrl();
    const trialEnd = trialEndParaCheckout(atual);
    const sessao = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: dono.orgId,
      line_items: [{ price: preco.id, quantity: 1 }],
      metadata: { org_id: dono.orgId, plano },
      subscription_data: {
        metadata: { org_id: dono.orgId, plano },
        // assinou durante o teste grátis: a 1ª cobrança fica para o fim do teste
        ...(trialEnd ? { trial_end: trialEnd } : {}),
      },
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
