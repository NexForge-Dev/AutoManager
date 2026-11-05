import { create } from "zustand";
import { createClient } from "./supabase/client";
import type {
  Produto,
  Variacao,
  Revendedora,
  Venda,
  VendaItem,
  Movimento,
  Config,
  Canal,
  FormaPagamento,
  Role,
  Membro,
  Entrega,
  StatusEntrega,
  Chamado,
  TipoChamado,
  EntradaPendente,
  OrigemRecebimento,
  ContaPagar,
} from "./types";
import type { Assinatura, PlanoId } from "./plans";
import { ehSuperadminUser } from "./admin";
import { registrarMetrica } from "./metricas/cliente";
import { falhaDeRedeAuth, recursoAusente, recursosFalhos, type RecursoCarga } from "./cargaLoja";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // randomUUID só existe em contexto seguro (https/localhost); abrindo pelo IP
  // da rede (http://192.168...) ele some. As colunas id são uuid, então o
  // fallback precisa ser um UUID v4 válido, senão o insert falha.
  const b = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// entrada do cadastro de produto (campos novos opcionais p/ não quebrar o onboarding)
export type NovoProduto = {
  nome: string;
  categoria: string;
  custo: number;
  precoVenda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  sku?: string;
  marca?: string;
  precoComparativo?: number;
  impostoPercent?: number;
  descricao?: string;
  imagens?: string[];
  variacoes?: Omit<Variacao, "id">[];
};

export type EditarProduto = Partial<
  Omit<Produto, "id" | "criadoEm" | "variacoes">
> & {
  variacoes?: Variacao[]; // lista completa desejada (com id p/ existentes, sem id p/ novas)
};

// soma o estoque das variações quando houver; senão usa o estoque base informado
function estoqueEfetivo(base: number, variacoes?: { estoqueAtual: number }[]) {
  if (variacoes && variacoes.length > 0)
    return variacoes.reduce((a, v) => a + (v.estoqueAtual || 0), 0);
  return base;
}

const configInicial: Config = {
  nomeLoja: "",
  segmento: "semijoias",
  categorias: [],
  canais: ["whatsapp"],
  usaRevendedoras: true,
  margemPadrao: 100,
  comissaoPadrao: 30,
  onboardingCompleto: false,
  corMarca: null,
  temaBase: null,
  appFonte: null,
  appRaio: null,
  logoUrl: null,
  plano: "solo",
  slug: null,
  lojaAtiva: false,
  lojaDescricao: null,
  lojaCapaUrl: null,
  lojaFonte: null,
  lojaSobre: null,
  lojaEmail: null,
  lojaWhatsapp: null,
  lojaTelefone: null,
  lojaInstagram: null,
  lojaFacebook: null,
  lojaTiktok: null,
};

function mapChamado(r: any): Chamado {
  return {
    id: r.id,
    orgId: r.org_id ?? null,
    usuarioId: r.usuario_id ?? null,
    nomeLoja: r.nome_loja ?? null,
    emailContato: r.email_contato ?? null,
    whatsapp: r.whatsapp ?? null,
    tipo: (r.tipo ?? "erro") as TipoChamado,
    assunto: r.assunto,
    mensagem: r.mensagem,
    status: r.status ?? "aberto",
    criadoEm: new Date(r.created_at).getTime(),
    resolvidoEm: r.resolved_at ? new Date(r.resolved_at).getTime() : null,
  };
}
function mapMembro(r: any): Membro {
  return { id: r.id, nome: r.nome ?? null, email: r.email ?? null, role: r.role };
}
function mapEntrega(r: any): Entrega {
  return {
    id: r.id,
    vendaId: r.venda_id ?? null,
    motoboyId: r.motoboy_id ?? null,
    clienteNome: r.cliente_nome ?? null,
    endereco: r.endereco ?? null,
    telefone: r.telefone ?? null,
    taxa: Number(r.taxa ?? 0),
    status: r.status,
    observacao: r.observacao ?? null,
    criadaEm: new Date(r.criada_em).getTime(),
    entregueEm: r.entregue_em ? new Date(r.entregue_em).getTime() : null,
  };
}

function mapEntradaPendente(r: any): EntradaPendente {
  return {
    id: r.id,
    valor: Number(r.valor ?? 0),
    origem: (r.origem ?? "manual") as OrigemRecebimento,
    descricao: r.descricao ?? null,
    pagador: r.pagador ?? null,
    formaPagamento: r.forma_pagamento ?? "pix",
    status: r.status ?? "pendente",
    vendaId: r.venda_id ?? null,
    recebidoEm: new Date(r.recebido_em).getTime(),
    decididoEm: r.decidido_em ? new Date(r.decidido_em).getTime() : null,
  };
}

function mapContaPagar(r: any): ContaPagar {
  return {
    id: r.id,
    descricao: r.descricao,
    categoria: r.categoria ?? null,
    fornecedor: r.fornecedor ?? null,
    valor: Number(r.valor ?? 0),
    vencimento: r.vencimento, // já vem "YYYY-MM-DD"
    status: r.status ?? "pendente",
    pagoEm: r.pago_em ? new Date(r.pago_em).getTime() : null,
    recorrente: !!r.recorrente,
    observacao: r.observacao ?? null,
    criadoEm: new Date(r.criado_em).getTime(),
  };
}

// ----------------------------------------------------- mapeadores row -> tipo
function mapVariacao(r: any): Variacao {
  return {
    id: r.id,
    nome: r.nome,
    sku: r.sku ?? undefined,
    estoqueAtual: r.estoque_atual,
    precoAjuste: Number(r.preco_ajuste ?? 0),
    ativo: r.ativo,
  };
}
function mapProduto(r: any): Produto {
  return {
    id: r.id,
    nome: r.nome,
    categoria: r.categoria,
    sku: r.sku ?? undefined,
    marca: r.marca ?? undefined,
    custo: Number(r.custo ?? 0), // o catálogo do vendedor vem sem custo (equipe_catalogo)
    precoVenda: Number(r.preco_venda),
    precoComparativo: r.preco_comparativo != null ? Number(r.preco_comparativo) : undefined,
    impostoPercent: Number(r.imposto_percent ?? 0),
    descricao: r.descricao ?? undefined,
    imagens: r.imagens ?? [],
    estoqueAtual: r.estoque_atual,
    estoqueMinimo: r.estoque_minimo,
    variacoes: (r.produto_variacao || [])
      .map(mapVariacao)
      .sort((a: Variacao, b: Variacao) => a.nome.localeCompare(b.nome)),
    ativo: r.ativo,
    criadoEm: new Date(r.criado_em).getTime(),
  };
}
function mapRevendedora(r: any): Revendedora {
  return {
    id: r.id,
    nome: r.nome,
    whatsapp: r.whatsapp ?? undefined,
    email: r.email ?? null,
    comissaoPercent: Number(r.comissao_percent ?? 0),
    metaMensal: Number(r.meta_mensal ?? 0),
    ativa: r.ativa,
    criadaEm: new Date(r.criada_em).getTime(),
    acessoLiberado: r.acesso_liberado ?? false,
    temAcesso: !!r.user_id,
  };
}
function mapVenda(r: any): Venda {
  return {
    id: r.id,
    data: new Date(r.data).getTime(),
    canal: r.canal,
    revendedoraId: r.revendedora_id,
    itens: (r.venda_item || []).map(
      (i: any): VendaItem => ({
        produtoId: i.produto_id,
        variacaoId: i.variacao_id ?? null,
        variacaoNome: i.variacao_nome ?? null,
        nome: i.nome,
        qtd: i.qtd,
        precoUnit: Number(i.preco_unit),
        custoUnit: Number(i.custo_unit),
        comissaoPercent: Number(i.comissao_percent_aplicada),
      })
    ),
    total: Number(r.total),
    custoTotal: Number(r.custo_total),
    comissaoTotal: Number(r.comissao_total),
    lucro: Number(r.lucro),
    statusComissao: r.status_comissao,
    formaPagamento: r.forma_pagamento ?? "dinheiro",
    parcelas: Number(r.parcelas ?? 1),
    statusPagamento: r.status_pagamento ?? "paga",
    desconto: Number(r.desconto ?? 0),
    dataPagamento: r.data_pagamento ? new Date(r.data_pagamento).getTime() : null,
  };
}

interface State {
  ready: boolean;
  orgId: string | null;
  usuarioId: string | null;
  email: string | null;
  // superadmin = app_metadata.role (só a service_role grava); só define a UI do /admin
  superadmin: boolean;
  role: Role;
  // autenticado, porém sem loja própria (revendedora/visitante): não pertence ao painel
  semOrg: boolean;
  // leitura da sessão, da org, do papel ou do plano falhou: não dá para saber quem é
  // nem o que pode. Nada de redirecionar ou decidir: a Guard mostra "tentar de novo".
  falhaEssencial: boolean;
  // demais leituras que falharam (o que estava no estado foi mantido)
  falhasCarga: RecursoCarga[];
  recarregando: boolean;
  config: Config;
  assinatura: Assinatura | null;
  produtos: Produto[];
  revendedoras: Revendedora[];
  vendas: Venda[];
  movimentos: Movimento[];
  membros: Membro[];
  entregas: Entrega[];
  entradasPendentes: EntradaPendente[];
  contasPagar: ContaPagar[];

  hydrate: () => Promise<void>;
  tentarDeNovo: () => Promise<void>;

  setConfig: (c: Partial<Config>) => Promise<Resultado>;
  definirSlug: (slug: string) => Promise<{ ok: boolean; erro?: string }>;
  completarOnboarding: () => Promise<Resultado>;

  criarMembro: (args: {
    nome: string;
    email: string;
    senha: string;
    role: Role;
  }) => Promise<{ ok: boolean; erro?: string }>;
  removerMembro: (id: string) => Promise<Resultado>;

  addEntrega: (e: {
    clienteNome: string;
    endereco: string;
    telefone?: string;
    taxa?: number;
    motoboyId?: string | null;
    vendaId?: string | null;
    observacao?: string;
  }) => Promise<{ ok: boolean; erro?: string }>;
  atribuirMotoboy: (entregaId: string, motoboyId: string | null) => Promise<Resultado>;
  setStatusEntrega: (entregaId: string, status: StatusEntrega) => Promise<Resultado>;
  // pool do motoboy: pegar uma entrega disponível / devolver ao balcão
  pegarEntrega: (entregaId: string) => Promise<{ ok: boolean; erro?: string }>;
  devolverEntrega: (entregaId: string) => Promise<Resultado>;
  recarregarEntregas: () => Promise<void>;

  addProduto: (p: NovoProduto) => Promise<Resultado>;
  importarProdutos: (linhas: NovoProduto[]) => Promise<{ ok: boolean; inseridos: number; erro?: string }>;
  updateProduto: (id: string, patch: EditarProduto) => Promise<Resultado>;
  // entrada RELATIVA (+qtd) e ajuste (define valor) feitos no banco via RPC;
  // variacaoId opcional (produto com grade exige variação)
  entradaEstoque: (id: string, qtd: number, variacaoId?: string | null) => Promise<Resultado>;
  ajustarEstoque: (id: string, novaQtd: number, motivo: string, variacaoId?: string | null) => Promise<Resultado>;

  addRevendedora: (r: Omit<Revendedora, "id" | "criadaEm" | "ativa" | "acessoLiberado" | "temAcesso">) => Promise<Resultado>;
  updateRevendedora: (id: string, patch: Partial<Revendedora>) => Promise<Resultado>;
  // libera o 1º acesso e devolve o código de convite (uso único) p/ o dono compartilhar
  liberarAcessoRevendedora: (id: string) => Promise<{ ok: boolean; codigo?: string; erro?: string; emailEmUso?: boolean }>;
  revogarAcessoRevendedora: (id: string) => Promise<void>;

  registrarVenda: (args: {
    itens: { produtoId: string; variacaoId?: string | null; qtd: number }[];
    canal: Canal;
    revendedoraId: string | null;
    formaPagamento: FormaPagamento;
    parcelas?: number;
    desconto?: number;
    fiado?: boolean;
  }) => Promise<{ venda: Venda | null; erro?: string }>;
  // marca como paga SÓ as vendas informadas (as que a tela somou/mostrou)
  marcarComissaoPaga: (revendedoraId: string, vendaIds: string[]) => Promise<Resultado>;
  marcarVendaRecebida: (vendaId: string) => Promise<Resultado>;
  // cancela a venda no banco (devolve estoque, anula comissão pendente)
  cancelarVenda: (vendaId: string) => Promise<Resultado>;

  // contas a pagar (financeiro)
  addContaPagar: (c: {
    descricao: string;
    valor: number;
    vencimento: string;
    categoria?: string | null;
    fornecedor?: string | null;
    recorrente?: boolean;
    observacao?: string | null;
  }) => Promise<{ ok: boolean; erro?: string }>;
  marcarContaPaga: (id: string, paga: boolean) => Promise<Resultado>;
  removerContaPagar: (id: string) => Promise<Resultado>;

  // caixa de entrada de recebimentos
  confirmarEntrada: (entradaId: string) => Promise<Venda | null>;
  recusarEntrada: (entradaId: string) => Promise<Resultado>;
  simularRecebimento: (args: { valor: number; descricao?: string }) => Promise<{ ok: boolean; erro?: string }>;

  // suporte / chamados
  abrirChamado: (args: {
    tipo: TipoChamado;
    assunto?: string;
    mensagem: string;
    emailContato?: string;
  }) => Promise<{ ok: boolean; erro?: string }>;
  // erro = não conseguiu ler (a tela mostra o erro em vez de "nenhum chamado")
  listarChamados: () => Promise<{ chamados: Chamado[]; erro?: string }>;
  resolverChamado: (id: string, resolvido: boolean) => Promise<Resultado>;
  // sair: limpa os dados da loja da memória (outra conta no mesmo navegador não vê nada)
  limpar: () => void;
}

// retorno padrão das ações que gravam no banco (a tela mostra `erro` se falhar)
export type Resultado = { ok: boolean; erro?: string };

// Lê TODAS as linhas de uma consulta em páginas (o PostgREST corta em 1000 por
// requisição). `montar` recria a query para cada faixa; precisa de ordem estável.
const PAGINA_LEITURA = 1000;
async function lerPaginado(
  montar: (de: number, ate: number) => PromiseLike<{ data: any[] | null; error: any }>
): Promise<{ data: any[]; error: any }> {
  const todas: any[] = [];
  for (let offset = 0; ; offset += PAGINA_LEITURA) {
    const { data, error } = await montar(offset, offset + PAGINA_LEITURA - 1);
    if (error) return { data: todas, error };
    if (!data || data.length === 0) break;
    todas.push(...data);
    if (data.length < PAGINA_LEITURA) break;
  }
  return { data: todas, error: null };
}

// mensagens amigáveis p/ erros levantados pelas RPCs de estoque/venda
export function erroAmigavel(msg: string | undefined): string {
  const m = msg || "";
  if (/sem_estoque|estoque_nao_negativo/.test(m)) return "Estoque insuficiente.";
  if (/escolha_variacao/.test(m)) return "Este produto tem variações: escolha a variação.";
  if (/sem_permissao/.test(m)) return "Só o dono da loja pode fazer isso.";
  if (/ja_cancelada/.test(m)) return "Essa venda já foi cancelada.";
  if (/venda_invalida/.test(m)) return "Venda não encontrada.";
  if (/produto_invalido|variacao_invalida/.test(m)) return "Produto não encontrado (foi excluído?).";
  if (/qtd_invalida/.test(m)) return "Quantidade inválida.";
  // regras do banco (migrations 0041/0042)
  if (/plano_sem_vendedores/.test(m))
    return "Seu acesso de vendedor está pausado pelo plano atual da loja. Fale com o dono.";
  if (/venda_canal_valido/.test(m)) return "Canal de venda inválido.";
  if (/canal_invalido|_len"|value too long/.test(m)) return "Texto muito longo. Encurte e tente de novo.";
  if (/numeric field overflow|out of range/i.test(m)) return "Valor alto demais. Confira o número digitado.";
  if (/limite_revendedoras/.test(m)) return "Você atingiu o limite de revendedoras do seu plano.";
  if (/limite_vendedores/.test(m)) return "Você atingiu o limite de vendedores do seu plano.";
  if (/preco_nao_negativo|valor_positivo|taxa_nao_negativa/.test(m)) return "Informe um valor maior ou igual a zero.";
  if (/comissao_faixa|comissao_padrao_faixa/.test(m)) return "A comissão precisa ficar entre 0% e 100%.";
  if (/use_cancelar_venda/.test(m)) return "Para cancelar uma venda, use o botão Cancelar venda.";
  if (/vinculo_somente_pela_ativacao/.test(m)) return "O acesso da revendedora é liberado pelo botão Liberar acesso.";
  if (/entrega_campo_bloqueado/.test(m)) return "Só o dono da loja altera os dados da entrega.";
  if (/papel_protegido|usuario_campo_protegido|org_campo_protegido/.test(m)) return "Só o suporte pode alterar isso.";
  if (/motoboy_invalido/.test(m)) return "Esse motoboy não faz parte da sua loja.";
  if (/chat_limite/.test(m)) return "Muitas mensagens em pouco tempo. Aguarde um minuto e tente de novo.";
  if (/org_slug_formato/.test(m)) return "Use só letras minúsculas, números e hífens no link (até 60 caracteres).";
  if (/permission denied|row-level security/i.test(m)) return "Você não tem permissão para fazer isso.";
  if (/failed to fetch|network/i.test(m)) return "Sem conexão. Tente de novo.";
  // mensagem crua do banco é em inglês e não ajuda ninguém: fica no console
  if (m) console.error("[erro não traduzido]", m);
  return "Não foi possível salvar. Tente de novo.";
}

// Plano da loja para qualquer papel. A tabela `assinatura` é só do dono
// (migration 0041: tem ids do provedor de pagamento); a RPC minha_assinatura
// (0042) devolve só os campos de plano. Sem a RPC (banco ainda sem a 0042),
// cai na leitura direta da tabela, como antes.
async function lerAssinatura(supabase: ReturnType<typeof createClient>): Promise<{ data: any; error: any }> {
  const { data, error } = await supabase.rpc("minha_assinatura");
  if (!error) return { data: data ?? null, error: null };
  // RPC que falhou por rede não é "banco sem a 0042": a tabela só responde ao dono e
  // devolveria vazio para a equipe, que veria a loja sem plano
  if (!recursoAusente(error)) return { data: null, error };
  const { data: tabela, error: erroTabela } = await supabase.from("assinatura").select("*").limit(1).maybeSingle();
  return { data: tabela ?? null, error: erroTabela };
}

// Vendedor lê o catálogo pela RPC, sem custo (0044). Sem a RPC (banco ainda sem a 0044),
// cai na tabela, como antes.
async function catalogoDoVendedor(
  supabase: ReturnType<typeof createClient>,
  ids: string[] | null
): Promise<{ data: any[] | null; error: any }> {
  const { data, error } = await supabase.rpc("equipe_catalogo", ids ? { p_ids: ids } : {});
  if (!error) return { data: (data as any[]) ?? [], error: null };
  if (!recursoAusente(error)) return { data: null, error };
  const tabela = () => supabase.from("produto").select("*, produto_variacao(*)");
  if (ids) return await tabela().in("id", ids);
  return await lerPaginado((de, ate) => tabela().order("id", { ascending: true }).range(de, ate));
}

async function revendedorasDoVendedor(
  supabase: ReturnType<typeof createClient>
): Promise<{ data: any[] | null; error: any }> {
  const { data, error } = await supabase.rpc("equipe_revendedoras");
  if (!error) return { data: (data as any[]) ?? [], error: null };
  if (!recursoAusente(error)) return { data: null, error };
  return await supabase.from("revendedora").select("*").order("criada_em", { ascending: true });
}

// Janela inicial de vendas carregada na hydrate (cobre painel + analytics de 6 meses).
// O histórico mais antigo é buscado em segundo plano, paginado, e mesclado.
const JANELA_VENDAS_DIAS = 180;
const PAGINA_VENDAS = 500;

export const useStore = create<State>()((set, get) => {
  const sb = () => createClient();

  // Relê do banco os produtos informados (com variações) e substitui no estado.
  // Usado após gravações de estoque p/ refletir o valor REAL (não o do cache).
  async function recarregarProdutos(ids: string[]) {
    const unicos = [...new Set(ids)].filter(Boolean);
    if (unicos.length === 0) return;
    const { data, error } =
      get().role === "vendedor"
        ? await catalogoDoVendedor(sb(), unicos)
        : await sb().from("produto").select("*, produto_variacao(*)").in("id", unicos);
    if (error || !data) return;
    const frescos = new Map(data.map((r: any) => [r.id as string, mapProduto(r)]));
    set((s) => ({
      produtos: s.produtos
        .filter((p) => !unicos.includes(p.id) || frescos.has(p.id))
        .map((p) => frescos.get(p.id) ?? p),
    }));
  }

  // Carga inteira da loja. Quem falha entra em falhaEssencial/falhasCarga: erro de
  // leitura nunca vira "não tem nada" (AUT-002/AUT-003).
  async function carregarLoja() {
    const supabase = sb();
    const {
      data: { user },
      error: erroSessao,
    } = await supabase.auth.getUser();
    if (!user) {
      set({ ready: true, falhaEssencial: falhaDeRedeAuth(erroSessao) });
      return;
    }

    // só a janela recente entra na carga inicial (resto vem em 2º plano, abaixo)
    const corteISO = new Date(Date.now() - JANELA_VENDAS_DIAS * 86_400_000).toISOString();

    // o papel decide de onde vêm produtos e revendedoras
    const lendoEu = supabase.from("usuario").select("role").eq("id", user.id).maybeSingle();
    const ehVendedor = async (): Promise<boolean> => (await lendoEu).data?.role === "vendedor";
    const lerProdutos = async (): Promise<{ data: any[] | null; error: any }> =>
      (await ehVendedor())
        ? catalogoDoVendedor(supabase, null)
        : // paginadas: sem isso o PostgREST corta em 1000 linhas e some dado
          lerPaginado((de, ate) =>
            supabase
              .from("produto")
              .select("*, produto_variacao(*)")
              .order("criado_em", { ascending: true })
              .order("id", { ascending: true })
              .range(de, ate)
          );
    const lerRevendedoras = async (): Promise<{ data: any[] | null; error: any }> =>
      (await ehVendedor())
        ? revendedorasDoVendedor(supabase)
        : await supabase.from("revendedora").select("*").order("criada_em", { ascending: true });

    const [
      { data: org, error: erroOrg },
      { data: eu, error: erroEu },
      { data: produtos, error: erroProdutos },
      { data: revendedoras, error: erroRevendedoras },
      { data: vendas, error: erroVendas },
      { data: membros, error: erroMembros },
      { data: entregas, error: erroEntregas },
      { data: entradas, error: erroEntradas },
      { data: contas, error: erroContas },
      { data: assin, error: erroAssin },
    ] = await Promise.all([
      supabase.from("org").select("*").limit(1).maybeSingle(),
      lendoEu,
      lerProdutos(),
      lerRevendedoras(),
      lerPaginado((de, ate) =>
        supabase
          .from("venda")
          .select("*, venda_item(*)")
          .gte("data", corteISO)
          .order("data", { ascending: false })
          .order("id", { ascending: true })
          .range(de, ate)
      ),
      supabase.from("usuario").select("id, nome, email, role"),
      lerPaginado((de, ate) =>
        supabase
          .from("entrega")
          .select("*")
          .order("criada_em", { ascending: false })
          .order("id", { ascending: true })
          .range(de, ate)
      ),
      // recebimentos pendentes de confirmação (tabela pode não existir se 0024 não rodou)
      supabase
        .from("entrada_pendente")
        .select("*")
        .eq("status", "pendente")
        .order("recebido_em", { ascending: false }),
      // contas a pagar (tabela pode não existir se 0033 não rodou)
      supabase.from("conta_pagar").select("*").order("vencimento", { ascending: true }),
      lerAssinatura(supabase),
    ]);

    // Sem saber a loja, o papel e o plano, qualquer decisão seria errada (mandar para
    // o onboarding, encerrar a sessão, bloquear recursos). Mantém tudo como está.
    const erroEssencial = erroOrg || erroEu || erroAssin;
    if (erroEssencial) {
      console.error("[hydrate] leitura essencial falhou", erroEssencial);
      set({ ready: true, falhaEssencial: true });
      return;
    }

    const falhas = recursosFalhos(
      {
        produtos: erroProdutos,
        revendedoras: erroRevendedoras,
        vendas: erroVendas,
        membros: erroMembros,
        entregas: erroEntregas,
        entradasPendentes: erroEntradas,
        contasPagar: erroContas,
      },
      ["entradasPendentes", "contasPagar"]
    );
    if (falhas.length) console.error("[hydrate] leituras falharam", falhas);

    const assinatura: Assinatura | null = assin
      ? {
          plano: assin.plano as PlanoId,
          status: assin.status,
          precoCentavos: Number(assin.preco_centavos ?? 0),
          periodo: assin.periodo ?? "mensal",
          dataInicio: assin.data_inicio ? new Date(assin.data_inicio).getTime() : null,
          dataFim: assin.data_fim ? new Date(assin.data_fim).getTime() : null,
          trialAte: assin.trial_ate ? new Date(assin.trial_ate).getTime() : null,
        }
      : null;

    // quem falhou fica fora do set: mantém o que já estava carregado em vez de zerar
    const dados: Partial<State> = {};
    if (!falhas.includes("produtos")) dados.produtos = (produtos || []).map(mapProduto);
    if (!falhas.includes("revendedoras")) dados.revendedoras = (revendedoras || []).map(mapRevendedora);
    if (!falhas.includes("vendas")) dados.vendas = (vendas || []).map(mapVenda);
    if (!falhas.includes("membros")) dados.membros = (membros || []).map(mapMembro);
    if (!falhas.includes("entregas")) dados.entregas = (entregas || []).map(mapEntrega);
    if (!falhas.includes("entradasPendentes")) dados.entradasPendentes = (entradas || []).map(mapEntradaPendente);
    if (!falhas.includes("contasPagar")) dados.contasPagar = (contas || []).map(mapContaPagar);

    set({
      ready: true,
      falhaEssencial: false,
      falhasCarga: falhas,
      orgId: org?.id ?? null,
      usuarioId: user.id,
      email: user.email ?? null,
      superadmin: ehSuperadminUser(user),
      role: (eu?.role as Role) ?? "owner",
      // sem linha em usuario = não é dono nem membro desta loja (revendedora/visitante)
      semOrg: !eu,
      assinatura,
      config: org
        ? {
            nomeLoja: org.nome,
            segmento: org.segmento,
            categorias: org.categorias ?? [],
            canais: org.canais,
            usaRevendedoras: org.usa_revendedoras,
            margemPadrao: Number(org.margem_padrao),
            comissaoPadrao: Number(org.comissao_padrao),
            onboardingCompleto: org.onboarding_completo,
            corMarca: org.cor_marca ?? null,
            temaBase: org.tema_base ?? null,
            appFonte: org.app_fonte ?? null,
            appRaio: org.app_raio ?? null,
            logoUrl: org.logo_url ?? null,
            plano: (assin?.plano as PlanoId) ?? "solo",
            slug: org.slug ?? null,
            lojaAtiva: org.loja_ativa ?? false,
            lojaDescricao: org.loja_descricao ?? null,
            lojaCapaUrl: org.loja_capa_url ?? null,
            lojaFonte: org.loja_fonte ?? null,
            lojaSobre: org.loja_sobre ?? null,
            lojaEmail: org.loja_email ?? null,
            lojaWhatsapp: org.loja_whatsapp ?? null,
            lojaTelefone: org.loja_telefone ?? null,
            lojaInstagram: org.loja_instagram ?? null,
            lojaFacebook: org.loja_facebook ?? null,
            lojaTiktok: org.loja_tiktok ?? null,
          }
        : configInicial,
      ...dados,
    });

    // 2ª fase: histórico anterior à janela, paginado e mesclado em segundo plano.
    // O app já está utilizável; relatórios de períodos longos vão se completando.
    void (async () => {
      for (let offset = 0; ; offset += PAGINA_VENDAS) {
        const { data: antigas, error } = await supabase
          .from("venda")
          .select("*, venda_item(*)")
          .lt("data", corteISO)
          .order("data", { ascending: false })
          .order("id", { ascending: true })
          .range(offset, offset + PAGINA_VENDAS - 1);
        if (error) {
          // relatório de período longo ficaria incompleto sem ninguém saber
          set((s) => (s.falhasCarga.includes("vendasAntigas") ? s : { falhasCarga: [...s.falhasCarga, "vendasAntigas"] }));
          break;
        }
        if (!antigas || antigas.length === 0) break;
        const mapeadas = antigas.map(mapVenda);
        set((s) => {
          const ids = new Set(s.vendas.map((v) => v.id));
          const novas = mapeadas.filter((v) => !ids.has(v.id));
          return novas.length ? { vendas: [...s.vendas, ...novas] } : s;
        });
        if (antigas.length < PAGINA_VENDAS) break;
      }
    })();
  }

  return {
    ready: false,
    orgId: null,
    usuarioId: null,
    email: null,
    superadmin: false,
    role: "owner",
    semOrg: false,
    falhaEssencial: false,
    falhasCarga: [],
    recarregando: false,
    config: configInicial,
    assinatura: null,
    produtos: [],
    revendedoras: [],
    vendas: [],
    movimentos: [],
    membros: [],
    entregas: [],
    entradasPendentes: [],
    contasPagar: [],

    tentarDeNovo: async () => {
      set({ recarregando: true });
      await get().hydrate();
      set({ recarregando: false });
    },

    hydrate: async () => {
      try {
        await carregarLoja();
      } catch (e) {
        // nunca deixa a tela presa no esqueleto
        console.error("[hydrate]", e);
        set({ ready: true, falhaEssencial: true });
      }
    },

    setConfig: async (c) => {
      const anterior = get().config;
      set((s) => ({ config: { ...s.config, ...c } }));
      const { orgId } = get();
      if (!orgId) return { ok: true };
      const patch: any = {};
      if (c.nomeLoja !== undefined) patch.nome = c.nomeLoja;
      if (c.segmento !== undefined) patch.segmento = c.segmento;
      if (c.categorias !== undefined) patch.categorias = c.categorias;
      if (c.canais !== undefined) patch.canais = c.canais;
      if (c.usaRevendedoras !== undefined) patch.usa_revendedoras = c.usaRevendedoras;
      if (c.margemPadrao !== undefined) patch.margem_padrao = c.margemPadrao;
      if (c.comissaoPadrao !== undefined) patch.comissao_padrao = c.comissaoPadrao;
      if (c.onboardingCompleto !== undefined) patch.onboarding_completo = c.onboardingCompleto;
      if (c.corMarca !== undefined) patch.cor_marca = c.corMarca;
      if (c.temaBase !== undefined) patch.tema_base = c.temaBase;
      if (c.appFonte !== undefined) patch.app_fonte = c.appFonte;
      if (c.appRaio !== undefined) patch.app_raio = c.appRaio;
      if (c.logoUrl !== undefined) patch.logo_url = c.logoUrl;
      if (c.slug !== undefined) patch.slug = c.slug;
      if (c.lojaAtiva !== undefined) patch.loja_ativa = c.lojaAtiva;
      if (c.lojaDescricao !== undefined) patch.loja_descricao = c.lojaDescricao;
      if (c.lojaCapaUrl !== undefined) patch.loja_capa_url = c.lojaCapaUrl;
      if (c.lojaFonte !== undefined) patch.loja_fonte = c.lojaFonte;
      if (c.lojaSobre !== undefined) patch.loja_sobre = c.lojaSobre;
      if (c.lojaEmail !== undefined) patch.loja_email = c.lojaEmail;
      if (c.lojaWhatsapp !== undefined) patch.loja_whatsapp = c.lojaWhatsapp;
      if (c.lojaTelefone !== undefined) patch.loja_telefone = c.lojaTelefone;
      if (c.lojaInstagram !== undefined) patch.loja_instagram = c.lojaInstagram;
      if (c.lojaFacebook !== undefined) patch.loja_facebook = c.lojaFacebook;
      if (c.lojaTiktok !== undefined) patch.loja_tiktok = c.lojaTiktok;

      let { error } = await sb().from("org").update(patch).eq("id", orgId);
      // resiliência: se as colunas de aparência ainda não existem no banco
      // (migrations 0014/0020 não aplicadas), salva o resto sem elas em vez de falhar tudo.
      if (error && /tema_base|app_fonte|app_raio|loja_capa_url|column/i.test(error.message)) {
        delete patch.tema_base;
        delete patch.app_fonte;
        delete patch.app_raio;
        delete patch.loja_capa_url;
        ({ error } = await sb().from("org").update(patch).eq("id", orgId));
      }
      if (error) {
        // desfaz só os campos deste patch (outro setConfig pode ter vindo no meio)
        const volta: Partial<Config> = {};
        for (const k of Object.keys(c) as (keyof Config)[]) (volta as any)[k] = anterior[k];
        set((s) => ({ config: { ...s.config, ...volta } }));
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      return { ok: true };
    },

    definirSlug: async (slug) => {
      const { orgId } = get();
      if (!orgId) return { ok: false, erro: "Loja não carregada" };
      const { error } = await sb().from("org").update({ slug }).eq("id", orgId);
      if (error)
        return {
          ok: false,
          erro: /duplicate|unique/i.test(error.message)
            ? "Esse link já está em uso. Tente outro."
            : erroAmigavel(error.message),
        };
      set((s) => ({ config: { ...s.config, slug } }));
      return { ok: true };
    },

    criarMembro: async ({ nome, email, senha, role }) => {
      const res = await fetch("/api/membros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, erro: json?.erro || "Falha ao criar membro" };
      if (json?.membro) set((s) => ({ membros: [...s.membros, json.membro] }));
      return { ok: true };
    },

    removerMembro: async (id) => {
      const anterior = get().membros.find((m) => m.id === id);
      set((s) => ({ membros: s.membros.filter((m) => m.id !== id) }));
      let erro: string | null = null;
      try {
        const res = await fetch("/api/membros", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          erro = json?.erro || "Falha ao remover membro";
        }
      } catch {
        erro = "Sem conexão. Tente de novo.";
      }
      if (erro) {
        // falhou -> devolve o membro à lista
        if (anterior)
          set((s) => (s.membros.some((m) => m.id === id) ? s : { membros: [...s.membros, anterior] }));
        return { ok: false, erro };
      }
      return { ok: true };
    },

    addEntrega: async (e) => {
      const { orgId } = get();
      const id = uid();
      const nova: Entrega = {
        id,
        vendaId: e.vendaId ?? null,
        motoboyId: e.motoboyId ?? null,
        clienteNome: e.clienteNome,
        endereco: e.endereco,
        telefone: e.telefone ?? null,
        taxa: e.taxa ?? 0,
        status: "pendente",
        observacao: e.observacao ?? null,
        criadaEm: Date.now(),
        entregueEm: null,
      };
      set((s) => ({ entregas: [nova, ...s.entregas] }));
      if (!orgId) return { ok: true };
      const { error } = await sb().from("entrega").insert({
        id,
        org_id: orgId,
        venda_id: e.vendaId ?? null,
        motoboy_id: e.motoboyId ?? null,
        cliente_nome: e.clienteNome,
        endereco: e.endereco,
        telefone: e.telefone ?? null,
        taxa: e.taxa ?? 0,
        observacao: e.observacao ?? null,
        status: "pendente",
      });
      // plano não libera entregas (trigger 0022) ou outro erro -> desfaz o otimista
      if (error) {
        set((s) => ({ entregas: s.entregas.filter((x) => x.id !== id) }));
        const erro = /entregas_nao_permitidas/.test(error.message)
          ? "Entregas estão disponíveis só no plano Expansão. Faça upgrade para registrar entregas."
          : erroAmigavel(error.message);
        return { ok: false, erro };
      }
      registrarMetrica({ tipo: "recurso", recurso: "entrega_criada" });
      return { ok: true };
    },

    atribuirMotoboy: async (entregaId, motoboyId) => {
      const anterior = get().entregas.find((e) => e.id === entregaId);
      set((s) => ({
        entregas: s.entregas.map((e) => (e.id === entregaId ? { ...e, motoboyId } : e)),
      }));
      const { error } = await sb().from("entrega").update({ motoboy_id: motoboyId }).eq("id", entregaId);
      if (error) {
        if (anterior)
          set((s) => ({
            entregas: s.entregas.map((e) => (e.id === entregaId ? { ...e, motoboyId: anterior.motoboyId } : e)),
          }));
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      return { ok: true };
    },

    setStatusEntrega: async (entregaId, status) => {
      const anterior = get().entregas.find((e) => e.id === entregaId);
      const entregueEm = status === "entregue" ? Date.now() : null;
      set((s) => ({
        entregas: s.entregas.map((e) =>
          e.id === entregaId ? { ...e, status, entregueEm } : e
        ),
      }));
      const { error } = await sb()
        .from("entrega")
        .update({
          status,
          entregue_em: entregueEm ? new Date(entregueEm).toISOString() : null,
        })
        .eq("id", entregaId);
      if (error) {
        if (anterior)
          set((s) => ({
            entregas: s.entregas.map((e) =>
              e.id === entregaId ? { ...e, status: anterior.status, entregueEm: anterior.entregueEm } : e
            ),
          }));
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      return { ok: true };
    },

    // motoboy reivindica uma entrega do balcão. O `.is("motoboy_id", null)`
    // garante a corrida: se outro já pegou, este update não afeta linha nenhuma.
    pegarEntrega: async (entregaId) => {
      const { usuarioId } = get();
      if (!usuarioId) return { ok: false, erro: "Sessão expirada. Entre de novo." };
      set((s) => ({
        entregas: s.entregas.map((e) => (e.id === entregaId ? { ...e, motoboyId: usuarioId } : e)),
      }));
      const { data, error } = await sb()
        .from("entrega")
        .update({ motoboy_id: usuarioId })
        .eq("id", entregaId)
        .is("motoboy_id", null)
        .select("id");
      if (error || !data || data.length === 0) {
        // não conseguiu (já pegaram / RLS / rede): ressincroniza com o banco
        await get().recarregarEntregas();
        return { ok: false, erro: error ? erroAmigavel(error.message) : "Outra pessoa já pegou esta entrega." };
      }
      return { ok: true };
    },

    // motoboy devolve a entrega ao balcão (volta a ficar sem dono).
    devolverEntrega: async (entregaId) => {
      const anterior = get().entregas.find((e) => e.id === entregaId);
      set((s) => ({
        entregas: s.entregas.map((e) => (e.id === entregaId ? { ...e, motoboyId: null } : e)),
      }));
      const { error } = await sb().from("entrega").update({ motoboy_id: null }).eq("id", entregaId);
      if (error) {
        if (anterior) set((s) => ({ entregas: s.entregas.map((e) => (e.id === entregaId ? anterior : e)) }));
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      return { ok: true };
    },

    recarregarEntregas: async () => {
      const supabase = sb();
      const { data, error } = await lerPaginado((de, ate) =>
        supabase
          .from("entrega")
          .select("*")
          .order("criada_em", { ascending: false })
          .order("id", { ascending: true })
          .range(de, ate)
      );
      if (error) return; // mantém a lista atual em vez de zerar por falha de rede
      set({ entregas: data.map(mapEntrega) });
    },

    completarOnboarding: async () => {
      set((s) => ({ config: { ...s.config, onboardingCompleto: true } }));
      const { orgId } = get();
      if (!orgId) return { ok: true };
      const { error } = await sb().from("org").update({ onboarding_completo: true }).eq("id", orgId);
      if (error) {
        set((s) => ({ config: { ...s.config, onboardingCompleto: false } }));
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      return { ok: true };
    },

    addProduto: async (p) => {
      const { orgId } = get();
      const id = uid();
      const variacoes: Variacao[] = (p.variacoes || []).map((v) => ({
        ...v,
        id: uid(),
      }));
      const estoqueAtual = estoqueEfetivo(p.estoqueAtual, variacoes);
      const novo: Produto = {
        id,
        nome: p.nome,
        categoria: p.categoria,
        sku: p.sku,
        marca: p.marca,
        custo: p.custo,
        precoVenda: p.precoVenda,
        precoComparativo: p.precoComparativo,
        impostoPercent: p.impostoPercent ?? 0,
        descricao: p.descricao,
        imagens: p.imagens || [],
        estoqueAtual,
        estoqueMinimo: p.estoqueMinimo,
        variacoes,
        ativo: true,
        criadoEm: Date.now(),
      };
      set((s) => ({ produtos: [...s.produtos, novo] }));
      if (!orgId) return { ok: true };
      const supabase = sb();
      const desfaz = () => set((s) => ({ produtos: s.produtos.filter((x) => x.id !== id) }));
      const { error } = await supabase.from("produto").insert({
        id,
        org_id: orgId,
        nome: p.nome,
        categoria: p.categoria,
        sku: p.sku || null,
        marca: p.marca || null,
        custo: p.custo,
        preco_venda: p.precoVenda,
        preco_comparativo: p.precoComparativo ?? null,
        imposto_percent: p.impostoPercent ?? 0,
        descricao: p.descricao || null,
        imagens: p.imagens || [],
        estoque_atual: estoqueAtual,
        estoque_minimo: p.estoqueMinimo,
        ativo: true,
      });
      if (error) {
        desfaz();
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      if (variacoes.length > 0) {
        const { error: errVar } = await supabase.from("produto_variacao").insert(
          variacoes.map((v) => ({
            id: v.id,
            org_id: orgId,
            produto_id: id,
            nome: v.nome,
            sku: v.sku || null,
            estoque_atual: v.estoqueAtual,
            preco_ajuste: v.precoAjuste,
            ativo: v.ativo,
          }))
        );
        if (errVar) {
          // sem as variações o produto ficaria com estoque "fantasma": desfaz tudo
          await supabase.from("produto").delete().eq("id", id);
          desfaz();
          return { ok: false, erro: erroAmigavel(errVar.message) };
        }
      }
      if (estoqueAtual > 0) {
        // histórico apenas: falha aqui não invalida o cadastro
        await supabase.from("movimento_estoque").insert({
          org_id: orgId,
          produto_id: id,
          tipo: "entrada",
          qtd: estoqueAtual,
          motivo: "Estoque inicial",
        });
      }
      registrarMetrica({ tipo: "recurso", recurso: "produto_cadastrado" });
      return { ok: true };
    },

    // Importação em lote (CSV): grava todos os produtos numa tacada só, sem
    // variações (a grade é cadastrada produto a produto). Registra a entrada de
    // estoque inicial dos que vieram com quantidade.
    importarProdutos: async (linhas) => {
      if (linhas.length === 0) return { ok: true, inseridos: 0 };
      const { orgId } = get();
      const agora = Date.now();
      const novos: Produto[] = linhas.map((p) => ({
        id: uid(),
        nome: p.nome,
        categoria: p.categoria,
        sku: p.sku,
        marca: p.marca,
        custo: p.custo,
        precoVenda: p.precoVenda,
        precoComparativo: p.precoComparativo,
        impostoPercent: p.impostoPercent ?? 0,
        descricao: p.descricao,
        imagens: [],
        estoqueAtual: p.estoqueAtual,
        estoqueMinimo: p.estoqueMinimo,
        variacoes: [],
        ativo: true,
        criadoEm: agora,
      }));
      set((s) => ({ produtos: [...s.produtos, ...novos] }));
      if (!orgId) return { ok: true, inseridos: novos.length };

      const supabase = sb();
      const { error } = await supabase.from("produto").insert(
        novos.map((p) => ({
          id: p.id,
          org_id: orgId,
          nome: p.nome,
          categoria: p.categoria,
          sku: p.sku || null,
          marca: p.marca || null,
          custo: p.custo,
          preco_venda: p.precoVenda,
          preco_comparativo: p.precoComparativo ?? null,
          imposto_percent: p.impostoPercent ?? 0,
          descricao: p.descricao || null,
          imagens: [],
          estoque_atual: p.estoqueAtual,
          estoque_minimo: p.estoqueMinimo,
          ativo: true,
        }))
      );
      // falhou -> desfaz o otimista
      if (error) {
        const ids = new Set(novos.map((p) => p.id));
        set((s) => ({ produtos: s.produtos.filter((p) => !ids.has(p.id)) }));
        return { ok: false, inseridos: 0, erro: erroAmigavel(error.message) };
      }
      registrarMetrica({ tipo: "recurso", recurso: "produto_cadastrado", quantidade: novos.length });

      const comEstoque = novos.filter((p) => p.estoqueAtual > 0);
      if (comEstoque.length > 0) {
        await supabase.from("movimento_estoque").insert(
          comEstoque.map((p) => ({
            org_id: orgId,
            produto_id: p.id,
            tipo: "entrada",
            qtd: p.estoqueAtual,
            motivo: "Importação inicial",
          }))
        );
      }
      return { ok: true, inseridos: novos.length };
    },

    updateProduto: async (id, patch) => {
      const { orgId } = get();
      const atual = get().produtos.find((p) => p.id === id);
      if (!atual) return { ok: false, erro: "Produto não encontrado." };

      // reconcilia variações (lista completa desejada substitui a atual)
      const novasVariacoes: Variacao[] | undefined = patch.variacoes
        ? patch.variacoes.map((v) => ({ ...v, id: v.id || uid() }))
        : undefined;
      const variacoesFinal = novasVariacoes ?? atual.variacoes;

      const merged: Produto = {
        ...atual,
        ...patch,
        variacoes: variacoesFinal,
      };
      merged.estoqueAtual = estoqueEfetivo(
        patch.estoqueAtual ?? atual.estoqueAtual,
        variacoesFinal
      );

      set((s) => ({ produtos: s.produtos.map((p) => (p.id === id ? merged : p)) }));
      if (!orgId) return { ok: true };
      const supabase = sb();

      // falhou no meio: ressincroniza com o banco (parte pode ter gravado);
      // se nem a leitura funcionar, volta ao estado anterior à edição.
      const falhou = async (msg: string | undefined): Promise<Resultado> => {
        set((s) => ({ produtos: s.produtos.map((p) => (p.id === id ? atual : p)) }));
        await recarregarProdutos([id]);
        return { ok: false, erro: erroAmigavel(msg) };
      };

      // ATENÇÃO: estoque_atual NÃO entra neste update. Gravar o valor do cache
      // apagaria vendas feitas em paralelo. Estoque só muda via RPC (abaixo),
      // e só quando o usuário de fato alterou a quantidade.
      const row: any = {};
      if (patch.nome !== undefined) row.nome = patch.nome;
      if (patch.categoria !== undefined) row.categoria = patch.categoria;
      if (patch.sku !== undefined) row.sku = patch.sku || null;
      if (patch.marca !== undefined) row.marca = patch.marca || null;
      if (patch.custo !== undefined) row.custo = patch.custo;
      if (patch.precoVenda !== undefined) row.preco_venda = patch.precoVenda;
      if (patch.precoComparativo !== undefined)
        row.preco_comparativo = patch.precoComparativo ?? null;
      if (patch.impostoPercent !== undefined) row.imposto_percent = patch.impostoPercent;
      if (patch.descricao !== undefined) row.descricao = patch.descricao || null;
      if (patch.imagens !== undefined) row.imagens = patch.imagens;
      if (patch.estoqueMinimo !== undefined) row.estoque_minimo = patch.estoqueMinimo;
      if (patch.ativo !== undefined) row.ativo = patch.ativo;
      if (Object.keys(row).length > 0) {
        const { error } = await supabase.from("produto").update(row).eq("id", id);
        if (error) return falhou(error.message);
      }

      let mexeuGrade = false;
      if (novasVariacoes) {
        const antes = new Map(atual.variacoes.map((v) => [v.id, v]));
        const depoisIds = new Set(novasVariacoes.map((v) => v.id));
        const removidas = [...antes.keys()].filter((vid) => !depoisIds.has(vid));
        if (removidas.length > 0) {
          mexeuGrade = true;
          const { error } = await supabase.from("produto_variacao").delete().in("id", removidas);
          if (error) return falhou(error.message);
        }
        for (const v of novasVariacoes) {
          const orig = antes.get(v.id);
          if (orig) {
            // dados cadastrais (sem estoque_atual)
            const { error } = await supabase
              .from("produto_variacao")
              .update({
                nome: v.nome,
                sku: v.sku || null,
                preco_ajuste: v.precoAjuste,
                ativo: v.ativo,
              })
              .eq("id", v.id);
            if (error) return falhou(error.message);
            // estoque só se o usuário mudou a quantidade: ajuste atômico no banco
            if (v.estoqueAtual !== orig.estoqueAtual) {
              mexeuGrade = true;
              const { error: errAj } = await supabase.rpc("ajustar_estoque", {
                p_produto: id,
                p_variacao: v.id,
                p_qtd: Math.max(0, v.estoqueAtual || 0),
                p_motivo: "Ajuste na edição do produto",
              });
              if (errAj) return falhou(errAj.message);
            }
          } else {
            // variação nova: linha nova, estoque inicial é o informado
            mexeuGrade = true;
            const { error } = await supabase.from("produto_variacao").insert({
              id: v.id,
              org_id: orgId,
              produto_id: id,
              nome: v.nome,
              sku: v.sku || null,
              estoque_atual: Math.max(0, v.estoqueAtual || 0),
              preco_ajuste: v.precoAjuste,
              ativo: v.ativo,
            });
            if (error) return falhou(error.message);
          }
        }
      }

      // grade mudou: agregado = soma das variações, calculada no banco
      if (mexeuGrade) {
        const { error } = await supabase.rpc("recalcular_estoque_produto", { p_produto: id });
        if (error) return falhou(error.message);
      }

      // sem grade: estoque base só é gravado se o usuário alterou o número
      if (
        variacoesFinal.length === 0 &&
        patch.estoqueAtual !== undefined &&
        patch.estoqueAtual !== atual.estoqueAtual
      ) {
        const { error } = await supabase.rpc("ajustar_estoque", {
          p_produto: id,
          p_variacao: null,
          p_qtd: Math.max(0, patch.estoqueAtual),
          p_motivo: "Ajuste na edição do produto",
        });
        if (error) return falhou(error.message);
      }

      // reflete o estoque real do banco (pode ter havido vendas em paralelo)
      await recarregarProdutos([id]);
      return { ok: true };
    },

    entradaEstoque: async (id, qtd, variacaoId = null) => {
      const { orgId } = get();
      const prod = get().produtos.find((x) => x.id === id);
      if (!prod) return { ok: false, erro: "Produto não encontrado." };
      if (!Number.isFinite(qtd) || qtd < 1) return { ok: false, erro: "Quantidade inválida." };
      // grade: o estoque é a soma das variações; dar entrada só no agregado
      // criaria estoque "fantasma" invendável. Exige a variação.
      if (prod.variacoes.length > 0 && !variacaoId)
        return { ok: false, erro: "Este produto tem variações: dê entrada pela variação." };

      // otimista RELATIVO (+qtd), p/ não pisar em outras mudanças do estado
      const aplica = (sinal: 1 | -1) =>
        set((s) => ({
          produtos: s.produtos.map((x) =>
            x.id !== id
              ? x
              : {
                  ...x,
                  estoqueAtual: x.estoqueAtual + sinal * qtd,
                  variacoes: x.variacoes.map((v) =>
                    v.id === variacaoId ? { ...v, estoqueAtual: v.estoqueAtual + sinal * qtd } : v
                  ),
                }
          ),
        }));
      aplica(1);
      if (!orgId) return { ok: true };

      const { data, error } = await sb().rpc("entrada_estoque", {
        p_produto: id,
        p_variacao: variacaoId,
        p_qtd: qtd,
        p_obs: "Reposição de estoque",
      });
      if (error) {
        aplica(-1);
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      // valor devolvido pelo banco é a verdade (inclui vendas paralelas)
      const r = data as any;
      set((s) => ({
        produtos: s.produtos.map((x) =>
          x.id !== id
            ? x
            : {
                ...x,
                estoqueAtual: Number(r?.estoque_produto ?? x.estoqueAtual),
                variacoes: x.variacoes.map((v) =>
                  v.id === variacaoId && r?.estoque_variacao != null
                    ? { ...v, estoqueAtual: Number(r.estoque_variacao) }
                    : v
                ),
              }
        ),
      }));
      return { ok: true };
    },

    ajustarEstoque: async (id, novaQtd, motivo, variacaoId = null) => {
      const { orgId } = get();
      const prod = get().produtos.find((x) => x.id === id);
      if (!prod) return { ok: false, erro: "Produto não encontrado." };
      if (!Number.isFinite(novaQtd) || novaQtd < 0) return { ok: false, erro: "Quantidade inválida." };
      // grade: ajuste é por variação; não mexe só no agregado.
      if (prod.variacoes.length > 0 && !variacaoId)
        return { ok: false, erro: "Este produto tem variações: ajuste pela variação." };

      const anterior = prod;
      set((s) => ({
        produtos: s.produtos.map((x) => {
          if (x.id !== id) return x;
          if (!variacaoId) return { ...x, estoqueAtual: novaQtd };
          const variacoes = x.variacoes.map((v) =>
            v.id === variacaoId ? { ...v, estoqueAtual: novaQtd } : v
          );
          return { ...x, variacoes, estoqueAtual: estoqueEfetivo(x.estoqueAtual, variacoes) };
        }),
      }));
      if (!orgId) return { ok: true };

      // define o valor NO BANCO (linha travada); o delta registrado é o real
      const { data, error } = await sb().rpc("ajustar_estoque", {
        p_produto: id,
        p_variacao: variacaoId,
        p_qtd: novaQtd,
        p_motivo: motivo,
      });
      if (error) {
        set((s) => ({ produtos: s.produtos.map((x) => (x.id === id ? anterior : x)) }));
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      const r = data as any;
      set((s) => ({
        produtos: s.produtos.map((x) =>
          x.id !== id
            ? x
            : {
                ...x,
                estoqueAtual: Number(r?.estoque_produto ?? x.estoqueAtual),
                variacoes: x.variacoes.map((v) =>
                  v.id === variacaoId && r?.estoque_variacao != null
                    ? { ...v, estoqueAtual: Number(r.estoque_variacao) }
                    : v
                ),
              }
        ),
      }));
      return { ok: true };
    },

    addRevendedora: async (r) => {
      const { orgId } = get();
      const id = uid();
      const nova: Revendedora = {
        ...r,
        id,
        ativa: true,
        criadaEm: Date.now(),
        acessoLiberado: false,
        temAcesso: false,
      };
      set((s) => ({ revendedoras: [...s.revendedoras, nova] }));
      if (!orgId) return { ok: true };
      const { error } = await sb().from("revendedora").insert({
        id,
        org_id: orgId,
        nome: r.nome,
        whatsapp: r.whatsapp || null,
        email: r.email || null,
        comissao_percent: r.comissaoPercent,
        meta_mensal: r.metaMensal || 0,
        ativa: true,
      });
      // limite do plano (trigger no banco) ou outro erro -> desfaz o otimista
      if (error) {
        set((s) => ({ revendedoras: s.revendedoras.filter((x) => x.id !== id) }));
        return {
          ok: false,
          erro: /limite_revendedoras/.test(error.message)
            ? "Você atingiu o limite de revendedoras do seu plano."
            : erroAmigavel(error.message),
        };
      }
      registrarMetrica({ tipo: "recurso", recurso: "revendedora_adicionada" });
      return { ok: true };
    },

    updateRevendedora: async (id, patch) => {
      const anterior = get().revendedoras.find((r) => r.id === id);
      set((s) => ({
        revendedoras: s.revendedoras.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));
      const { orgId } = get();
      if (!orgId) return { ok: true };
      const row: any = {};
      if (patch.nome !== undefined) row.nome = patch.nome;
      if (patch.whatsapp !== undefined) row.whatsapp = patch.whatsapp || null;
      if (patch.email !== undefined) row.email = patch.email || null;
      if (patch.comissaoPercent !== undefined) row.comissao_percent = patch.comissaoPercent;
      if (patch.metaMensal !== undefined) row.meta_mensal = patch.metaMensal;
      if (patch.ativa !== undefined) row.ativa = patch.ativa;
      if (patch.acessoLiberado !== undefined) row.acesso_liberado = patch.acessoLiberado;
      if (Object.keys(row).length === 0) return { ok: true };
      const { error } = await sb().from("revendedora").update(row).eq("id", id);
      if (error) {
        if (anterior)
          set((s) => ({ revendedoras: s.revendedoras.map((r) => (r.id === id ? anterior : r)) }));
        return {
          ok: false,
          erro: /limite_revendedoras/.test(error.message)
            ? "Você atingiu o limite de revendedoras do seu plano."
            : erroAmigavel(error.message),
        };
      }
      return { ok: true };
    },

    liberarAcessoRevendedora: async (id) => {
      const { data, error } = await sb().rpc("liberar_revendedora", { p_id: id });
      if (error) {
        const erro = /sem_email/.test(error.message)
          ? "Cadastre o e-mail dela antes de liberar o acesso."
          : /ja_ativada/.test(error.message)
          ? "Essa revendedora já ativou o acesso."
          : "Não foi possível liberar o acesso agora.";
        return { ok: false, erro };
      }
      set((s) => ({
        revendedoras: s.revendedoras.map((r) => (r.id === id ? { ...r, acessoLiberado: true } : r)),
      }));
      // e-mail que já tem conta nunca ativa: avisa agora (sem a RPC, banco sem a 0044, segue)
      const { data: emUso } = await sb().rpc("revendedora_email_em_uso", { p_id: id });
      return { ok: true, codigo: (data as any)?.codigo, emailEmUso: emUso === true };
    },

    revogarAcessoRevendedora: async (id) => {
      set((s) => ({
        revendedoras: s.revendedoras.map((r) => (r.id === id ? { ...r, acessoLiberado: false } : r)),
      }));
      await sb().rpc("revogar_revendedora", { p_id: id });
    },

    registrarVenda: async ({ itens, canal, revendedoraId, formaPagamento, parcelas = 1, desconto = 0, fiado = false }) => {
      const parcelasNorm = formaPagamento === "credito" ? Math.max(1, parcelas) : 1;
      const s = get();
      const { orgId } = s;
      const rev = revendedoraId ? s.revendedoras.find((r) => r.id === revendedoraId) : null;
      const comissaoPercent = rev ? rev.comissaoPercent : 0;

      // valida estoque (por variação quando houver)
      for (const it of itens) {
        const prod = s.produtos.find((p) => p.id === it.produtoId);
        if (!prod) return { venda: null, erro: "Um produto do carrinho não existe mais. Atualize a página." };
        if (it.variacaoId) {
          const v = prod.variacoes.find((x) => x.id === it.variacaoId);
          if (!v) return { venda: null, erro: `A variação escolhida de "${prod.nome}" não existe mais.` };
          if (v.estoqueAtual < it.qtd) return { venda: null, erro: `Estoque insuficiente de "${prod.nome} - ${v.nome}".` };
        } else if (prod.variacoes.length > 0) {
          return { venda: null, erro: `"${prod.nome}" tem variações: escolha a variação.` };
        } else if (prod.estoqueAtual < it.qtd) {
          return { venda: null, erro: `Estoque insuficiente de "${prod.nome}".` };
        }
      }

      const vendaItens: VendaItem[] = itens.map((it) => {
        const prod = s.produtos.find((p) => p.id === it.produtoId)!;
        const v = it.variacaoId
          ? prod.variacoes.find((x) => x.id === it.variacaoId)
          : null;
        return {
          produtoId: prod.id,
          variacaoId: v ? v.id : null,
          variacaoNome: v ? v.nome : null,
          nome: prod.nome,
          qtd: it.qtd,
          precoUnit: prod.precoVenda + (v ? v.precoAjuste : 0),
          custoUnit: prod.custo,
          comissaoPercent,
        };
      });

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const bruto = vendaItens.reduce((a, i) => a + i.precoUnit * i.qtd, 0);
      const desc = round2(Math.min(Math.max(desconto, 0), bruto));
      const total = round2(bruto - desc);
      const custoTotal = round2(vendaItens.reduce((a, i) => a + i.custoUnit * i.qtd, 0));
      // comissão sobre o total JÁ com desconto (igual à UI e ao RPC registrar_venda)
      const comissaoTotal = round2((total * comissaoPercent) / 100);
      const lucro = round2(total - custoTotal - comissaoTotal);
      const vendaId = uid();
      const data = Date.now();
      const statusPagamento = fiado ? "pendente" : "paga";
      const dataPagamento = fiado ? null : data;

      const venda: Venda = {
        id: vendaId,
        data,
        canal,
        revendedoraId,
        itens: vendaItens,
        total,
        custoTotal,
        comissaoTotal,
        lucro,
        statusComissao: "pendente",
        formaPagamento,
        parcelas: parcelasNorm,
        statusPagamento,
        desconto: desc,
        dataPagamento,
      };

      // total vendido por produto (somando itens repetidos do mesmo produto)
      const baixaPorProduto = new Map<string, number>();
      for (const it of itens)
        baixaPorProduto.set(it.produtoId, (baixaPorProduto.get(it.produtoId) || 0) + it.qtd);

      // otimista - baixa no agregado do produto e na variação correspondente
      set((st) => ({
        vendas: [venda, ...st.vendas],
        produtos: st.produtos.map((p) => {
          const baixa = baixaPorProduto.get(p.id);
          if (!baixa) return p;
          const variacoes = p.variacoes.map((v) => {
            const venQtd = itens
              .filter((x) => x.variacaoId === v.id)
              .reduce((a, x) => a + x.qtd, 0);
            return venQtd ? { ...v, estoqueAtual: v.estoqueAtual - venQtd } : v;
          });
          return { ...p, estoqueAtual: p.estoqueAtual - baixa, variacoes };
        }),
      }));

      if (!orgId) return { venda };

      // Tudo numa transação atômica no banco (valida estoque, grava venda+itens,
      // baixa estoque relativo e movimentos). O id vem do cliente p/ casar com o otimista.
      const { data: res, error } = await sb().rpc("registrar_venda", {
        p_venda_id: vendaId,
        p_itens: itens.map((it) => ({
          produto_id: it.produtoId,
          variacao_id: it.variacaoId ?? null,
          qtd: it.qtd,
        })),
        p_canal: canal,
        p_revendedora_id: revendedoraId,
        p_forma: formaPagamento,
        p_parcelas: parcelasNorm,
        p_desconto: desc,
        p_fiado: fiado,
      });

      // erro no banco (estoque, RLS, rede) -> desfaz o otimista: remove a venda
      // e restaura o estoque dos produtos afetados ao valor anterior à venda.
      if (error) {
        const afetados = new Set(baixaPorProduto.keys());
        set((st) => ({
          vendas: st.vendas.filter((v) => v.id !== vendaId),
          produtos: st.produtos.map((p) => {
            if (!afetados.has(p.id)) return p;
            const orig = s.produtos.find((o) => o.id === p.id);
            return orig ?? p;
          }),
        }));
        // o cache pode estar velho (ex.: sem_estoque por venda em paralelo): ressincroniza
        void recarregarProdutos([...afetados]);
        return { venda: null, erro: erroAmigavel(error.message) };
      }

      registrarMetrica({ tipo: "recurso", recurso: revendedoraId ? "venda_revendedora" : "venda_registrada" });

      // o banco é a fonte da verdade: sobrescreve totais/comissão/lucro do otimista
      const r = res as any;
      const confirmada: Venda = r
        ? {
            ...venda,
            total: Number(r.total ?? venda.total),
            custoTotal: Number(r.custo_total ?? venda.custoTotal),
            comissaoTotal: Number(r.comissao_total ?? venda.comissaoTotal),
            lucro: Number(r.lucro ?? venda.lucro),
          }
        : venda;
      set((st) => ({ vendas: st.vendas.map((v) => (v.id === vendaId ? confirmada : v)) }));
      // estoque real (outras vendas podem ter baixado as mesmas peças)
      void recarregarProdutos([...baixaPorProduto.keys()]);

      return { venda: confirmada };
    },

    // Paga SÓ as vendas que a tela somou (ids explícitos). Antes marcava todas
    // as pendentes da revendedora, inclusive vendas que entraram depois da
    // conferência (outra aba / venda dela) e que o dono não viu nem pagou.
    marcarComissaoPaga: async (revendedoraId, vendaIds) => {
      const ids = new Set(vendaIds);
      if (ids.size === 0) return { ok: true };
      const alvo = (v: Venda) =>
        ids.has(v.id) && v.revendedoraId === revendedoraId && v.statusComissao === "pendente";
      const afetadas = get().vendas.filter(alvo).map((v) => v.id);
      if (afetadas.length === 0) return { ok: true };
      const marcadas = new Set(afetadas);
      set((s) => ({
        vendas: s.vendas.map((v) => (marcadas.has(v.id) ? { ...v, statusComissao: "paga" } : v)),
      }));
      const { orgId } = get();
      if (!orgId) return { ok: true };
      const { error } = await sb()
        .from("venda")
        .update({ status_comissao: "paga" })
        .in("id", afetadas)
        .eq("revendedora_id", revendedoraId)
        .eq("status_comissao", "pendente");
      if (error) {
        set((s) => ({
          vendas: s.vendas.map((v) =>
            marcadas.has(v.id) && v.statusComissao === "paga" ? { ...v, statusComissao: "pendente" } : v
          ),
        }));
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      return { ok: true };
    },

    marcarVendaRecebida: async (vendaId) => {
      const anterior = get().vendas.find((v) => v.id === vendaId);
      if (!anterior) return { ok: false, erro: "Venda não encontrada." };
      if (anterior.statusPagamento === "cancelada")
        return { ok: false, erro: "Venda cancelada não pode ser recebida." };
      const agora = Date.now();
      set((s) => ({
        vendas: s.vendas.map((v) =>
          v.id === vendaId ? { ...v, statusPagamento: "paga", dataPagamento: agora } : v
        ),
      }));
      const { orgId } = get();
      if (!orgId) return { ok: true };
      const { error } = await sb()
        .from("venda")
        .update({ status_pagamento: "paga", data_pagamento: new Date(agora).toISOString() })
        .eq("id", vendaId)
        .neq("status_pagamento", "cancelada");
      if (error) {
        set((s) => ({
          vendas: s.vendas.map((v) =>
            v.id === vendaId
              ? { ...v, statusPagamento: anterior.statusPagamento, dataPagamento: anterior.dataPagamento }
              : v
          ),
        }));
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      return { ok: true };
    },

    // Cancelamento atômico no banco (RPC cancelar_venda): devolve o estoque,
    // registra o movimento, marca 'cancelada' e anula a comissão pendente.
    // Sem otimista: só muda a tela depois que o banco confirmou.
    cancelarVenda: async (vendaId) => {
      const venda = get().vendas.find((v) => v.id === vendaId);
      if (!venda) return { ok: false, erro: "Venda não encontrada." };
      if (venda.statusPagamento === "cancelada") return { ok: false, erro: "Essa venda já foi cancelada." };
      const { orgId } = get();
      const comissaoPendente = venda.statusComissao === "pendente";
      let atualizada: Venda = {
        ...venda,
        statusPagamento: "cancelada",
        statusComissao: comissaoPendente ? "cancelada" : venda.statusComissao,
        comissaoTotal: comissaoPendente ? 0 : venda.comissaoTotal,
        lucro: comissaoPendente ? Math.round((venda.total - venda.custoTotal) * 100) / 100 : venda.lucro,
      };
      if (orgId) {
        const { data, error } = await sb().rpc("cancelar_venda", { p_venda: vendaId });
        if (error) return { ok: false, erro: erroAmigavel(error.message) };
        const r = data as any;
        if (r)
          atualizada = {
            ...atualizada,
            statusComissao: (r.status_comissao ?? atualizada.statusComissao) as Venda["statusComissao"],
            comissaoTotal: Number(r.comissao_total ?? atualizada.comissaoTotal),
            lucro: Number(r.lucro ?? atualizada.lucro),
          };
      }
      set((s) => ({ vendas: s.vendas.map((v) => (v.id === vendaId ? atualizada : v)) }));
      const ids = venda.itens.map((i) => i.produtoId).filter(Boolean);
      if (orgId) {
        // estoque devolvido no banco: relê os produtos para mostrar o valor real
        await recarregarProdutos(ids);
      } else {
        set((s) => ({
          produtos: s.produtos.map((p) => {
            const its = venda.itens.filter((i) => i.produtoId === p.id);
            if (its.length === 0) return p;
            const volta = its.reduce((a, i) => a + i.qtd, 0);
            const variacoes = p.variacoes.map((v) => {
              const q = its.filter((i) => i.variacaoId === v.id).reduce((a, i) => a + i.qtd, 0);
              return q ? { ...v, estoqueAtual: v.estoqueAtual + q } : v;
            });
            return { ...p, estoqueAtual: p.estoqueAtual + volta, variacoes };
          }),
        }));
      }
      return { ok: true };
    },

    addContaPagar: async (c) => {
      const { orgId } = get();
      if (!c.descricao.trim()) return { ok: false, erro: "Informe a descrição da conta." };
      if (!c.valor || c.valor <= 0) return { ok: false, erro: "Informe um valor válido." };
      if (!c.vencimento) return { ok: false, erro: "Informe a data de vencimento." };
      if (c.vencimento < "2000-01-01" || c.vencimento > "2100-12-31")
        return { ok: false, erro: "Confira o ano do vencimento." };
      const id = uid();
      const nova: ContaPagar = {
        id,
        descricao: c.descricao.trim(),
        categoria: c.categoria?.trim() || null,
        fornecedor: c.fornecedor?.trim() || null,
        valor: c.valor,
        vencimento: c.vencimento,
        status: "pendente",
        pagoEm: null,
        recorrente: !!c.recorrente,
        observacao: c.observacao?.trim() || null,
        criadoEm: Date.now(),
      };
      set((s) => ({ contasPagar: [...s.contasPagar, nova] }));
      if (!orgId) return { ok: true };
      const { error } = await sb().from("conta_pagar").insert({
        id,
        org_id: orgId,
        descricao: nova.descricao,
        categoria: nova.categoria,
        fornecedor: nova.fornecedor,
        valor: nova.valor,
        vencimento: nova.vencimento,
        recorrente: nova.recorrente,
        observacao: nova.observacao,
        status: "pendente",
      });
      if (error) {
        set((s) => ({ contasPagar: s.contasPagar.filter((x) => x.id !== id) }));
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      registrarMetrica({ tipo: "recurso", recurso: "conta_a_pagar" });
      return { ok: true };
    },

    marcarContaPaga: async (id, paga) => {
      const anterior = get().contasPagar.find((c) => c.id === id);
      const pagoEm = paga ? Date.now() : null;
      set((s) => ({
        contasPagar: s.contasPagar.map((c) =>
          c.id === id ? { ...c, status: paga ? "paga" : "pendente", pagoEm } : c
        ),
      }));
      const { orgId } = get();
      if (!orgId) return { ok: true };
      const { error } = await sb()
        .from("conta_pagar")
        .update({
          status: paga ? "paga" : "pendente",
          pago_em: pagoEm ? new Date(pagoEm).toISOString() : null,
        })
        .eq("id", id);
      if (error) {
        if (anterior)
          set((s) => ({ contasPagar: s.contasPagar.map((c) => (c.id === id ? anterior : c)) }));
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      return { ok: true };
    },

    removerContaPagar: async (id) => {
      const anterior = get().contasPagar.find((c) => c.id === id);
      set((s) => ({ contasPagar: s.contasPagar.filter((c) => c.id !== id) }));
      const { error } = await sb().from("conta_pagar").delete().eq("id", id);
      if (error) {
        if (anterior) set((s) => ({ contasPagar: [...s.contasPagar, anterior] }));
        return { ok: false, erro: erroAmigavel(error.message) };
      }
      return { ok: true };
    },

    // "Sim, foi venda da loja": transforma o recebimento numa venda avulsa (sem itens,
    // só o valor) e marca a entrada como confirmada, ligando-a à venda criada.
    confirmarEntrada: async (entradaId) => {
      const s = get();
      const { orgId } = s;
      const entrada = s.entradasPendentes.find((e) => e.id === entradaId);
      if (!entrada || !orgId) return null;

      const vendaId = uid();
      const data = entrada.recebidoEm || Date.now();
      const venda: Venda = {
        id: vendaId,
        data,
        canal: "loja",
        revendedoraId: null,
        itens: [],
        total: entrada.valor,
        custoTotal: 0,
        comissaoTotal: 0,
        lucro: entrada.valor,
        statusComissao: "paga",
        formaPagamento: entrada.formaPagamento,
        parcelas: 1,
        statusPagamento: "paga",
        desconto: 0,
        dataPagamento: data,
      };

      // otimista: a venda entra na lista e a entrada sai da caixa
      set((st) => ({
        vendas: [venda, ...st.vendas],
        entradasPendentes: st.entradasPendentes.filter((e) => e.id !== entradaId),
      }));

      // cria a venda e marca a entrada como confirmada na MESMA transação.
      // Idempotente: confirmar de novo (duplo-clique/2ª aba) não duplica a venda.
      const { error } = await sb().rpc("confirmar_entrada", {
        p_entrada_id: entradaId,
        p_venda_id: vendaId,
      });

      // erro -> desfaz: tira a venda otimista e devolve a entrada à caixa
      if (error) {
        set((st) => ({
          vendas: st.vendas.filter((v) => v.id !== vendaId),
          entradasPendentes: st.entradasPendentes.some((e) => e.id === entradaId)
            ? st.entradasPendentes
            : [entrada, ...st.entradasPendentes],
        }));
        return null;
      }

      registrarMetrica({ tipo: "recurso", recurso: "recebimento_confirmado" });
      return venda;
    },

    // "Não foi da loja": só arquiva a entrada, sem gerar venda.
    recusarEntrada: async (entradaId) => {
      const anterior = get().entradasPendentes.find((e) => e.id === entradaId);
      set((st) => ({
        entradasPendentes: st.entradasPendentes.filter((e) => e.id !== entradaId),
      }));
      const { error } = await sb()
        .from("entrada_pendente")
        .update({ status: "recusada", decidido_em: new Date().toISOString() })
        .eq("id", entradaId)
        .eq("status", "pendente");
      // falhou -> devolve a entrada à caixa pra não "sumir" sem persistir
      if (error && anterior)
        set((st) => ({
          entradasPendentes: st.entradasPendentes.some((e) => e.id === entradaId)
            ? st.entradasPendentes
            : [anterior, ...st.entradasPendentes],
        }));
      if (error) return { ok: false, erro: erroAmigavel(error.message) };
      return { ok: true };
    },

    // Cria um recebimento de teste (enquanto não há banco conectado de verdade),
    // pra você ver a caixa de entrada e o fluxo de confirmação funcionando.
    simularRecebimento: async ({ valor, descricao }) => {
      const { orgId } = get();
      if (!orgId) return { ok: false, erro: "Loja não carregada" };
      if (!valor || valor <= 0) return { ok: false, erro: "Informe um valor válido." };
      const id = uid();
      const recebidoEm = Date.now();
      const { error } = await sb().from("entrada_pendente").insert({
        id,
        org_id: orgId,
        valor,
        origem: "manual",
        descricao: descricao || "Recebimento de teste",
        forma_pagamento: "pix",
        status: "pendente",
        recebido_em: new Date(recebidoEm).toISOString(),
      });
      if (error) return { ok: false, erro: erroAmigavel(error.message) };
      set((st) => ({
        entradasPendentes: [
          {
            id,
            valor,
            origem: "manual",
            descricao: descricao || "Recebimento de teste",
            pagador: null,
            formaPagamento: "pix",
            status: "pendente",
            vendaId: null,
            recebidoEm,
            decididoEm: null,
          },
          ...st.entradasPendentes,
        ],
      }));
      return { ok: true };
    },

    // pela rota do servidor: ela grava e repassa ao Painel NexForge (precisa da chave)
    abrirChamado: async ({ tipo, assunto, mensagem, emailContato }) => {
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo, assunto, mensagem, emailContato, pagina: window.location.pathname }),
        });
        if (res.ok) return { ok: true };
        const json = await res.json().catch(() => ({}));
        return { ok: false, erro: json?.erro || "Não foi possível enviar. Tente de novo." };
      } catch {
        return { ok: false, erro: "Sem conexão. Tente de novo." };
      }
    },

    listarChamados: async () => {
      const { data, error } = await sb()
        .from("chamado")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return { chamados: [], erro: erroAmigavel(error.message) };
      return { chamados: (data || []).map(mapChamado) };
    },

    resolverChamado: async (id, resolvido) => {
      const { error } = await sb()
        .from("chamado")
        .update({
          status: resolvido ? "resolvido" : "aberto",
          resolved_at: resolvido ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) return { ok: false, erro: erroAmigavel(error.message) };
      return { ok: true };
    },

    limpar: () =>
      set({
        ready: false,
        orgId: null,
        usuarioId: null,
        email: null,
        superadmin: false,
        role: "owner",
        semOrg: false,
        falhaEssencial: false,
        falhasCarga: [],
        recarregando: false,
        config: configInicial,
        assinatura: null,
        produtos: [],
        revendedoras: [],
        vendas: [],
        movimentos: [],
        membros: [],
        entregas: [],
        entradasPendentes: [],
        contasPagar: [],
      }),
  };
});
