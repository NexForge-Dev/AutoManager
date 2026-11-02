// Validações de entrada compartilhadas pelas rotas de API (servidor).

/** E-mail normalizado: sem espaços nas pontas e em minúsculas. */
export function normalizarEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

// Formato prático de e-mail (sem aspas/comentários do RFC). Fica de fora tudo o
// que é curinga ou metacaractere em filtros (% * , ( ) espaço) — a busca é por
// igualdade, mas um e-mail assim também não deve virar conta no Auth.
const EMAIL = /^[a-z0-9.!#$&'+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Espera o e-mail já normalizado (ver normalizarEmail). */
export function emailValido(email: string): boolean {
  return email.length > 0 && email.length <= 254 && EMAIL.test(email);
}

/** Mesmo mínimo da tela de redefinir senha. */
export const SENHA_MIN = 8;
/** Limite do bcrypt no GoTrue. */
export const SENHA_MAX = 72;
export const NOME_MAX = 120;

/** UUID (qualquer versão) — evita mandar lixo para o banco e receber erro cru. */
export function uuidValido(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Traduz erros do GoTrue (auth.admin.createUser etc.) para mensagens em pt-BR.
 * Nunca devolve a mensagem crua: o que não for reconhecido vira `padrao`.
 */
export function erroAuthPtBr(mensagem: string | undefined | null, padrao: string): string {
  const m = mensagem ?? "";
  if (/already|exists|registered/i.test(m)) return "E-mail já cadastrado";
  if (/password.*(at least|short|weak)|weak.?password/i.test(m)) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres e não pode ser fraca.`;
  if (/password.*(long|72)/i.test(m)) return `A senha pode ter no máximo ${SENHA_MAX} caracteres.`;
  if (/invalid.*email|email.*invalid|unable to validate email/i.test(m)) return "E-mail inválido";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (/papel_nao_permitido|limite_vendedores|database error/i.test(m))
    return "Não foi possível adicionar o membro: confira o limite do seu plano e tente de novo.";
  return padrao;
}
