import { waLink } from "./contato";
import { brl } from "./analytics";

// Regras da vitrine pública (testáveis no node).

type ProdutoPedido = { nome: string; preco_venda: number };
type VariacaoPedido = { nome: string; preco_ajuste: number };

export const precoDaVariacao = (p: ProdutoPedido, v?: VariacaoPedido | null) =>
  Number(p.preco_venda) + Number(v?.preco_ajuste ?? 0);

/** Link do WhatsApp com o pedido escrito. "" quando a loja não tem WhatsApp. */
export function linkPedido(numero: string | null | undefined, p: ProdutoPedido, v?: VariacaoPedido | null): string {
  const base = waLink(numero);
  if (!base) return "";
  const item = v ? `${p.nome} (${v.nome})` : p.nome;
  const texto = `Olá! Tenho interesse em: ${item}, ${brl(precoDaVariacao(p, v))}. Ainda está disponível?`;
  return `${base}?text=${encodeURIComponent(texto)}`;
}

/**
 * O chat da vitrine precisa do login anônimo. false = desligado no Supabase; null = não
 * deu para saber (na dúvida o botão fica: se falhar, o próprio chat explica).
 */
export async function loginAnonimoLigado(
  url: string | undefined,
  chave: string | undefined,
  buscar: typeof fetch = (...a) => fetch(...a)
): Promise<boolean | null> {
  if (!url || !chave) return null;
  try {
    const r = await buscar(`${url}/auth/v1/settings`, { headers: { apikey: chave } });
    if (!r.ok) return null;
    const j = await r.json();
    const v = j?.external?.anonymous_users;
    return typeof v === "boolean" ? v : null;
  } catch {
    return null;
  }
}
