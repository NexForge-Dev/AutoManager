// Carga dos dados da loja: separa "a leitura falhou" de "não tem nada".
// Regras puras (sem Supabase/store: testáveis no node).

export type RecursoCarga =
  | "produtos"
  | "revendedoras"
  | "vendas"
  | "vendasAntigas"
  | "membros"
  | "entregas"
  | "entradasPendentes"
  | "contasPagar";

export const ROTULO_RECURSO: Record<RecursoCarga, string> = {
  produtos: "produtos",
  revendedoras: "revendedoras",
  vendas: "vendas",
  vendasAntigas: "vendas mais antigas",
  membros: "equipe",
  entregas: "entregas",
  entradasPendentes: "recebimentos",
  contasPagar: "contas a pagar",
};

// O que cada tela precisa para mostrar a verdade. Se um destes falhou, a tela dá lugar
// ao aviso com "tentar de novo": lista vazia ali faria o dono achar que perdeu os dados
// e cadastrar tudo de novo. Tela fora da lista não depende da carga (ou usa só o que
// não falhou) e mostra só a faixa de aviso.
const RECURSOS_DA_ROTA: Record<string, RecursoCarga[]> = {
  "/painel": ["produtos", "vendas", "revendedoras", "contasPagar", "entradasPendentes"],
  "/vender": ["produtos", "revendedoras"],
  "/produtos": ["produtos"],
  "/reposicao": ["produtos", "vendas"],
  "/financeiro": ["vendas", "contasPagar"],
  "/recebimentos": ["entradasPendentes"],
  "/relatorios": ["vendas", "revendedoras"],
  "/analytics": ["produtos", "vendas"],
  "/revendedoras": ["revendedoras", "vendas"],
  "/entregas": ["entregas", "membros"],
  "/configuracoes": ["membros"],
  "/configuracoes/plano": ["revendedoras", "membros"],
  "/planos": ["revendedoras", "membros"],
  "/minha-loja": ["produtos"],
  "/perfil": ["produtos", "vendas"],
};

export function falhasDaRota(path: string, falhas: RecursoCarga[]): RecursoCarga[] {
  const precisa = RECURSOS_DA_ROTA[path] ?? [];
  return falhas.filter((f) => precisa.includes(f));
}

// PostgREST: tabela ou função ainda não criada (banco sem a migration). Isso é "não
// existe", não uma falha passageira: tentar de novo não resolve.
const CODIGOS_AUSENTE = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);
export function recursoAusente(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && CODIGOS_AUSENTE.has(error.code);
}

/** Lista quem falhou. `opcionais` podem não existir em banco sem a migration. */
export function recursosFalhos(
  erros: Partial<Record<RecursoCarga, any>>,
  opcionais: RecursoCarga[] = []
): RecursoCarga[] {
  return (Object.keys(erros) as RecursoCarga[]).filter(
    (r) => erros[r] && !(opcionais.includes(r) && recursoAusente(erros[r]))
  );
}

export function textoFalhas(falhas: RecursoCarga[]): string {
  const nomes = falhas.map((f) => ROTULO_RECURSO[f]);
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

// getUser sem usuário pode ser "sem sessão" (vai para o login) ou "não deu para
// perguntar" (rede/servidor fora, a sessão continua valendo). Só o 2º caso é falha.
export function falhaDeRedeAuth(error: { name?: string; status?: number } | null | undefined): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  return typeof error.status === "number" && (error.status === 0 || error.status >= 500);
}

/** Leitura que não respondeu: quem chama mostra "tentar de novo", nunca "sem dados". */
export class FalhaLeitura extends Error {
  constructor(mensagem = "falha_leitura") {
    super(mensagem);
    this.name = "FalhaLeitura";
  }
}
