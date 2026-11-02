import { homeDe } from "./permissoes";
import type { Role } from "./types";

// Regras puras do destino pós-login (sem Supabase/store: testáveis no node).

/** revendedora_situacao (0042): null = não é revendedora; 'suspensa' = é, mas a loja/plano bloqueou. */
export type SituacaoRevendedora = "ativa" | "suspensa" | null;

/** /acesso?motivo=... — o /acesso mostra a mensagem e encerra a sessão. */
export const MOTIVOS_ACESSO = {
  suspenso:
    "Seu acesso de revendedora está suspenso pela loja no momento. Fale com a loja para reativar.",
  sem_loja:
    "Esta conta não está ligada a nenhuma loja ativa. Se você é revendedora, use o link de acesso que a loja enviou; se é da equipe, fale com o dono da loja.",
} as const;
export type MotivoAcesso = keyof typeof MOTIVOS_ACESSO;

export function motivoDaUrl(search: string): MotivoAcesso | null {
  const m = new URLSearchParams(search).get("motivo");
  return m && Object.hasOwn(MOTIVOS_ACESSO, m) ? (m as MotivoAcesso) : null;
}

/**
 * Regra pura do destino depois do login (testada em destinoPosLogin.test.ts).
 * Só o DONO (linha em public.usuario com role owner) vai para o onboarding:
 * quem não tem loja — revendedora suspensa pelo plano, convite que não vinculou —
 * vai para o /acesso com o motivo, nunca para "criar uma loja".
 */
export function decidirDestino(e: {
  situacaoRevendedora: SituacaoRevendedora;
  semOrg: boolean;
  role: Role;
  onboardingCompleto: boolean;
}): string {
  if (e.situacaoRevendedora === "ativa") return "/revenda";
  if (e.semOrg) return `/acesso?motivo=${e.situacaoRevendedora === "suspensa" ? "suspenso" : "sem_loja"}`;
  if (!e.onboardingCompleto && e.role === "owner") return "/onboarding";
  return homeDe(e.role);
}
