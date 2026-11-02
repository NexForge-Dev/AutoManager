import { NextResponse } from "next/server";

/**
 * Resposta de erro interno das rotas de API: o detalhe (mensagem do Postgres,
 * do GoTrue, do Stripe...) vai só para o log do servidor; o cliente recebe uma
 * mensagem genérica em pt-BR e um código estável.
 */
export function erroInterno(
  contexto: string,
  e: unknown,
  mensagem = "Não foi possível concluir agora. Tente novamente.",
  status = 500
) {
  const detalhe = e instanceof Error ? e.message : (e as { message?: string } | null)?.message ?? String(e);
  console.error(`[${contexto}]`, detalhe);
  return NextResponse.json({ erro: mensagem, codigo: "erro_interno" }, { status });
}
