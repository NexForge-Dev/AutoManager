import { createHash } from "node:crypto";

// Limite de tentativas guardado no banco (migration 0038): em serverless cada
// request pode cair numa instância diferente, então contador em memória não serve.
// As chaves vão com hash SHA-256 — o banco nunca vê IP nem e-mail em claro.

/** O mínimo do client do Supabase que o limitador usa (facilita o teste). */
export interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export type Regra = { max: number; janelaSegundos: number };

/** Ativação da revendedora: código de 6 chars, uso único, 7 dias de validade. */
export const LIMITES_ATIVACAO = {
  porIp: { max: 10, janelaSegundos: 15 * 60 },
  porEmail: { max: 5, janelaSegundos: 15 * 60 },
} satisfies Record<string, Regra>;

export function chaveLimite(escopo: string, valor: string): string {
  const h = createHash("sha256").update(valor.trim().toLowerCase()).digest("hex");
  return `${escopo}:${h}`;
}

/** IP do cliente atrás do proxy da Vercel (primeiro do x-forwarded-for). */
export function ipDaRequisicao(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  return ip || "desconhecido";
}

/**
 * Registra uma tentativa e diz se ainda pode seguir.
 * Se o banco falhar (ex.: migration ainda não aplicada) o pedido SEGUE (fail-open)
 * e o erro vai para o log: o limitador é uma defesa extra — o código de convite
 * continua obrigatório, de uso único e com validade.
 */
export async function dentroDoLimite(sb: RpcClient, chave: string, regra: Regra): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("rate_limit_registrar", {
      p_chave: chave,
      p_max: regra.max,
      p_janela_segundos: regra.janelaSegundos,
    });
    if (error) {
      console.error("[rate-limit] falha ao registrar tentativa:", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("[rate-limit] falha ao registrar tentativa:", e instanceof Error ? e.message : e);
    return true;
  }
}

/** Verifica várias chaves (todas contam a tentativa); bloqueia se qualquer uma estourar. */
export async function todasDentroDoLimite(sb: RpcClient, regras: { chave: string; regra: Regra }[]): Promise<boolean> {
  const r = await Promise.all(regras.map(({ chave, regra }) => dentroDoLimite(sb, chave, regra)));
  return r.every(Boolean);
}
