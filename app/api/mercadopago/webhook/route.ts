import { NextResponse } from "next/server";
import { enviarMetricas } from "@/lib/metricas/servidor";
import crypto from "crypto";
import {
  buscarPreapproval,
  aplicarPreapproval,
  buscarPagamento,
  registrarRecebimentoMP,
  buscarPagamentoAutorizado,
  aplicarPagamentoAutorizado,
} from "@/lib/mercadopago";

// Valida a assinatura (x-signature) do Mercado Pago.
// Manifesto conforme docs do MP: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
// Sem MP_WEBHOOK_SECRET: em PRODUÇÃO falha fechado (rejeita tudo); em dev deixa
// passar para facilitar testes locais.
type ResultadoAssinatura = "ok" | "invalida" | "sem_segredo";
function verificarAssinatura(req: Request, dataId: string): ResultadoAssinatura {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV === "production" ? "sem_segredo" : "ok";
  const sig = req.headers.get("x-signature") || "";
  const reqId = req.headers.get("x-request-id") || "";
  const parts: Record<string, string> = {};
  for (const kv of sig.split(",")) {
    const [k, v] = kv.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return "invalida";
  // o MP assina o data.id em minúsculas quando é alfanumérico
  const manifest = `id:${dataId.toLowerCase()};request-id:${reqId};ts:${ts};`;
  const esperado = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return esperado.length === v1.length &&
      crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(v1))
      ? "ok"
      : "invalida";
  } catch {
    return "invalida";
  }
}

// Webhook do Mercado Pago. Trata três tipos de evento:
//  - subscription_preapproval / preapproval: assinatura de plano -> aplica o plano.
//  - subscription_authorized_payment: cobrança do ciclo da assinatura ->
//      aprovada estende data_fim (active); recusada marca past_due.
//  - payment: pagamento avulso recebido -> grava na caixa de entrada da loja.
// Qualquer outro tópico responde 200 (para o MP não reenviar).
// Segurança: NÃO confiamos no corpo da notificação. Pegamos só o ID e
// re-consultamos o estado real na API do MP com nosso access token - assim
// uma notificação forjada não consegue ativar plano nem lançar recebimento.
// Erros reais (API do MP / banco) respondem 500 -> o MP reenvia mais tarde.

type Topico = "preapproval" | "pagamento_autorizado" | "pagamento" | null;

function classificar(tipo: unknown): Topico {
  if (typeof tipo !== "string") return null;
  const t = tipo.toLowerCase();
  if (t.includes("authorized_payment")) return "pagamento_autorizado";
  if (t.includes("preapproval_plan")) return null; // modelo de plano, não assinatura
  if (t.includes("preapproval")) return "preapproval";
  if (t === "payment" || t.startsWith("payment.")) return "pagamento";
  return null;
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const url = new URL(req.url);
  const tipo = body?.type || body?.topic || url.searchParams.get("type") || url.searchParams.get("topic");
  // a assinatura do MP é calculada sobre o data.id da query string; usa-o primeiro
  const id =
    url.searchParams.get("data.id") || body?.data?.id || url.searchParams.get("id") || body?.id;

  const topico = classificar(tipo);
  if (!topico || !id) {
    // responde 200 para o MP não reenviar eventos que não nos interessam
    return NextResponse.json({ ignorado: true });
  }

  const assinatura = verificarAssinatura(req, String(id));
  if (assinatura === "sem_segredo") {
    // falha fechado: sem segredo em produção não dá para distinguir notificação
    // forjada. 500 faz o MP reenviar depois que o segredo for configurado.
    console.error("MP_WEBHOOK_SECRET não configurado em produção - webhook rejeitado");
    return NextResponse.json({ erro: "webhook nao configurado" }, { status: 500 });
  }
  if (assinatura === "invalida") {
    return NextResponse.json({ erro: "assinatura invalida" }, { status: 401 });
  }

  try {
    if (topico === "preapproval") {
      const pre = await buscarPreapproval(String(id));
      await aplicarPreapproval(pre);
    } else if (topico === "pagamento_autorizado") {
      const ap = await buscarPagamentoAutorizado(String(id));
      await aplicarPagamentoAutorizado(ap);
    } else {
      const pag = await buscarPagamento(String(id));
      await registrarRecebimentoMP(pag);
    }
  } catch (e) {
    // 500 faz o MP reenviar mais tarde (retry) - bom para falhas transitórias
    const msg = e instanceof Error ? e.message : "erro";
    console.error("Webhook MP falhou", topico, id, msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }

  await enviarMetricas();
  return NextResponse.json({ ok: true });
}

// O MP às vezes faz um GET de verificação na URL do webhook.
export async function GET() {
  return NextResponse.json({ ok: true });
}
