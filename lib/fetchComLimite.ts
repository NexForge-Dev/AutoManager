// fetch com prazo para a resposta começar a chegar. Sem isso, em rede ruim uma leitura
// pendurada deixa a tela no esqueleto para sempre, sem erro para mostrar "tentar de novo".
// Upload de foto fica de fora: em rede móvel ele pode levar mais que isso de verdade.
export const LIMITE_RESPOSTA_MS = 30_000;

export function fetchComLimite(
  limiteMs = LIMITE_RESPOSTA_MS,
  base: typeof fetch = (...a) => fetch(...a),
  aoSemSessao?: () => void
): typeof fetch {
  return async (entrada, init) => {
    const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (url.includes("/storage/v1/")) return base(entrada, init);

    const prazo = new AbortController();
    const externo = init?.signal;
    const repassar = () => prazo.abort(externo?.reason);
    if (externo?.aborted) repassar();
    externo?.addEventListener("abort", repassar);
    const timer = setTimeout(() => prazo.abort(new DOMException("Tempo esgotado", "TimeoutError")), limiteMs);
    try {
      const resposta = await base(entrada, { ...init, signal: prazo.signal });
      if (resposta.status === 401 && url.includes("/rest/v1/")) aoSemSessao?.();
      return resposta;
    } finally {
      clearTimeout(timer);
      externo?.removeEventListener("abort", repassar);
    }
  };
}
