// Rascunho que sobrevive a refresh (e ao login de novo, se a sessão expirar) na mesma aba.
// sessionStorage pode lançar (armazenamento bloqueado): aí só não guarda.

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
