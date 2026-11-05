// Rascunho que sobrevive a refresh (e ao login de novo, se a sessão expirar) na mesma aba.
// sessionStorage pode lançar (armazenamento bloqueado): aí só não guarda.

// Sempre por usuário: outra conta no mesmo aparelho e aba não vê o rascunho desta.
const PREFIXOS = ["am_carrinho_", "am_onboarding_"];
export const chaveCarrinho = (orgId: string | null, usuarioId: string | null) => `am_carrinho_${orgId}_${usuarioId}`;
export const chaveOnboarding = (usuarioId: string) => `am_onboarding_${usuarioId}`;

/** Sair de propósito leva os rascunhos junto; sessão expirada não passa por aqui. */
export function apagarRascunhos() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && PREFIXOS.some((p) => k.startsWith(p))) sessionStorage.removeItem(k);
    }
  } catch {
    /* sem armazenamento */
  }
}

export function lerRascunho<T>(chave: string): T | null {
  try {
    const bruto = sessionStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

export function gravarRascunho(chave: string, valor: unknown) {
  try {
    sessionStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem armazenamento */
  }
}

export function apagarRascunho(chave: string) {
  try {
    sessionStorage.removeItem(chave);
  } catch {
    /* sem armazenamento */
  }
}
