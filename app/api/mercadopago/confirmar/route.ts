import { NextResponse } from "next/server";
import { enviarMetricas } from "@/lib/metricas/servidor";
import { createClient as createServer } from "@/lib/supabase/server";
import { buscarPreapproval, aplicarPreapproval, lerRef } from "@/lib/mercadopago";

// Chamado pela tela de assinatura quando o dono volta do checkout do MP.
// Confirma o status na hora (sem depender só do webhook) e aplica o plano.
// Valida que a preapproval pertence à org do próprio dono antes de aplicar.

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

export async function POST(req: Request) {
  const dono = await donoDaOrg();
  if (!dono) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const { preapproval_id } = (await req.json().catch(() => ({}))) as { preapproval_id?: string };
  if (!preapproval_id) return NextResponse.json({ erro: "preapproval_id ausente" }, { status: 400 });

  try {
    const pre = await buscarPreapproval(preapproval_id);
    const ref = lerRef(pre.external_reference);
    // segurança: a assinatura precisa ser da org de quem está logado
    if (!ref || ref.orgId !== dono.orgId)
      return NextResponse.json({ erro: "Assinatura não pertence a esta loja" }, { status: 403 });

    const plano = await aplicarPreapproval(pre);
    await enviarMetricas();
    return NextResponse.json({ status: pre.status, plano });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao confirmar pagamento";
    return NextResponse.json({ erro: msg }, { status: 502 });
  }
}
