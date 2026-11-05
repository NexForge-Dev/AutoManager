import { emailValido, normalizarEmail } from "./validacao";
import type { TipoChamado } from "./types";

// Validação do que chega em POST /api/feedback (balão de feedback e card de suporte).
// Sem dependências de servidor: o balão usa os mesmos rótulos e limites.

export const FEEDBACK_MAX = 4000;
const ASSUNTO_MAX = 200; // constraint chamado_assunto_len (0043)
const PAGINA_MAX = 150;

export const ROTULO_FEEDBACK: Record<TipoChamado, string> = {
  sugestao: "Ajude-nos a melhorar",
  erro: "Reportar um problema",
  duvida: "Dúvida",
};

export const KIND_FEEDBACK: Record<TipoChamado, "suggestion" | "problem"> = {
  sugestao: "suggestion",
  erro: "problem",
  duvida: "problem",
};

/** Só o caminho: query string e fragmento podem carregar tokens ou e-mails. */
export function paginaSegura(v: unknown): string {
  if (typeof v !== "string") return "";
  const p = v.split(/[?#]/, 1)[0].trim();
  return p.startsWith("/") && p.length <= PAGINA_MAX ? p : "";
}

export type DadosFeedback = {
  tipo: TipoChamado;
  mensagem: string;
  /** o que foi digitado; vazio no balão, que não tem esse campo */
  assuntoDigitado: string;
  /** o que vai para o banco: `assunto` é obrigatório na tabela */
  assunto: string;
  pagina: string;
  emailContato: string;
};

export function validarFeedback(corpo: unknown): { ok: true; dados: DadosFeedback } | { ok: false; erro: string } {
  const c = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;

  const tipo = c.tipo as TipoChamado;
  if (typeof tipo !== "string" || !Object.keys(ROTULO_FEEDBACK).includes(tipo))
    return { ok: false, erro: "Escolha uma opção." };

  const mensagem = typeof c.mensagem === "string" ? c.mensagem.trim() : "";
  if (!mensagem) return { ok: false, erro: "Escreva sua mensagem." };
  if (mensagem.length > FEEDBACK_MAX)
    return { ok: false, erro: `A mensagem pode ter no máximo ${FEEDBACK_MAX} caracteres.` };

  const assuntoDigitado = typeof c.assunto === "string" ? c.assunto.trim() : "";
  if (assuntoDigitado.length > ASSUNTO_MAX)
    return { ok: false, erro: `O assunto pode ter no máximo ${ASSUNTO_MAX} caracteres.` };

  const emailContato = normalizarEmail(c.emailContato);
  if (emailContato && !emailValido(emailContato)) return { ok: false, erro: "E-mail inválido." };

  const pagina = paginaSegura(c.pagina);
  // sem assunto digitado (balão): o rótulo e a página aparecem no admin, sem coluna nova
  const assunto = assuntoDigitado || (pagina ? `${ROTULO_FEEDBACK[tipo]} (${pagina})` : ROTULO_FEEDBACK[tipo]);

  return { ok: true, dados: { tipo, mensagem, assuntoDigitado, assunto, pagina, emailContato } };
}
