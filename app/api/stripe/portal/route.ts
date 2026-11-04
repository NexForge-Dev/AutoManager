import { NextResponse } from "next/server";
import { donoDaOrg } from "@/lib/donoDaOrg";
import { adminClient, appUrl, limparClienteStripe, objetoStripeAusente, stripe } from "@/lib/stripe";

export const runtime = "nodejs";

// Abre o Customer Portal do Stripe (cartão, faturas, cancelamento). Só o DONO.
export async function POST() {
  const dono = await donoDaOrg();
  if (!dono) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const admin = adminClient();
  const { data, error } = await admin
    .from("assinatura")
    .select("provider_cliente_id")
    .eq("org_id", dono.orgId)
    .maybeSingle();
  if (error) return NextResponse.json({ erro: "Falha ao ler a assinatura" }, { status: 500 });
  const customer = data?.provider_cliente_id;
  const semAssinatura = () => NextResponse.json({ erro: "Sua loja ainda não tem uma assinatura paga." }, { status: 400 });
  if (!customer?.startsWith("cus_")) return semAssinatura();

  try {
    const s = await stripe().billingPortal.sessions.create({
      customer,
      return_url: `${appUrl()}/configuracoes/plano`,
      locale: "pt-BR",
    });
    return NextResponse.json({ url: s.url });
  } catch (e) {
    // cliente apagado no Stripe ou de outro modo (teste x live): não há o que gerenciar
    if (objetoStripeAusente(e)) {
      await limparClienteStripe(admin, dono.orgId, customer);
      return semAssinatura();
    }
    console.error("Falha ao abrir o portal Stripe", e);
    return NextResponse.json({ erro: "Não foi possível abrir o portal de pagamento agora." }, { status: 502 });
  }
}
