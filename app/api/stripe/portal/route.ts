import { NextResponse } from "next/server";
import { donoDaOrg } from "@/lib/donoDaOrg";
import { adminClient, appUrl, stripe } from "@/lib/stripe";

export const runtime = "nodejs";

// Abre o Customer Portal do Stripe (cartão, faturas, cancelamento). Só o DONO.
export async function POST() {
  const dono = await donoDaOrg();
  if (!dono) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const { data, error } = await adminClient()
    .from("assinatura")
    .select("provider_cliente_id")
    .eq("org_id", dono.orgId)
    .maybeSingle();
  if (error) return NextResponse.json({ erro: "Falha ao ler a assinatura" }, { status: 500 });
  const customer = data?.provider_cliente_id;
  if (!customer?.startsWith("cus_"))
    return NextResponse.json({ erro: "Sua loja ainda não tem uma assinatura paga." }, { status: 400 });

  try {
    const s = await stripe().billingPortal.sessions.create({
      customer,
      return_url: `${appUrl()}/configuracoes/plano`,
      locale: "pt-BR",
    });
    return NextResponse.json({ url: s.url });
  } catch (e) {
    console.error("Falha ao abrir o portal Stripe", e);
    return NextResponse.json({ erro: "Não foi possível abrir o portal de pagamento agora." }, { status: 502 });
  }
}
