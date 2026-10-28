export type Canal = "loja" | "whatsapp" | "instagram";
export type Role = "owner" | "vendedor" | "motoboy";
export type Plano = "ambulante" | "solo" | "equipe" | "expansao";
export type StatusEntrega = "pendente" | "a_caminho" | "entregue";
// "cancelada" = comissão anulada pelo cancelamento da venda (RPC cancelar_venda)
export type StatusComissao = "pendente" | "paga" | "cancelada";
export type TipoMovimento = "entrada" | "saida" | "ajuste";
export type FormaPagamento = "dinheiro" | "pix" | "credito" | "debito" | "boleto";
export type StatusPagamento = "paga" | "pendente" | "cancelada";
export type OrigemRecebimento = "mercadopago" | "inter" | "manual";
export type StatusEntrada = "pendente" | "confirmada" | "recusada";
export type StatusContaPagar = "pendente" | "paga";

export interface Variacao {
  id: string;
  nome: string;          // ex.: "Aro 16", "Dourado / P"
  sku?: string;
  estoqueAtual: number;
  precoAjuste: number;   // delta sobre o preço base
  ativo: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  sku?: string;
  marca?: string;
  custo: number;
  precoVenda: number;
  precoComparativo?: number; // preço "de" (riscado)
  impostoPercent: number;
  descricao?: string;
  imagens: string[];
  estoqueAtual: number;
  estoqueMinimo: number;
  variacoes: Variacao[];
  ativo: boolean;
  criadoEm: number;
}

export interface Revendedora {
  id: string;
  nome: string;
  whatsapp?: string;
  email?: string | null;
  comissaoPercent: number;
  metaMensal: number;
  ativa: boolean;
  criadaEm: number;
  acessoLiberado: boolean;
  temAcesso: boolean; // já ativou o login (user_id preenchido)
}

export interface VendaItem {
  produtoId: string;
  variacaoId?: string | null;
  variacaoNome?: string | null;
  nome: string;
  qtd: number;
  precoUnit: number;
  custoUnit: number;
  comissaoPercent: number;
}

export interface Venda {
  id: string;
  data: number;
  canal: Canal;
  revendedoraId: string | null;
  itens: VendaItem[];
  total: number;
  custoTotal: number;
  comissaoTotal: number;
  lucro: number;
  statusComissao: StatusComissao;
  formaPagamento: FormaPagamento;
  parcelas: number;
  statusPagamento: StatusPagamento;
  desconto: number;
  dataPagamento: number | null;
}

// Recebimento detectado numa conta conectada, aguardando o dono confirmar se foi venda.
export interface EntradaPendente {
  id: string;
  valor: number;
  origem: OrigemRecebimento;
  descricao: string | null;
  pagador: string | null;
  formaPagamento: FormaPagamento;
  status: StatusEntrada;
  vendaId: string | null;
  recebidoEm: number;
  decididoEm: number | null;
}

// Conta a pagar (despesa) — o lado que SAI do fluxo de caixa.
export interface ContaPagar {
  id: string;
  descricao: string;
  categoria: string | null;
  fornecedor: string | null;
  valor: number;
  vencimento: string; // "YYYY-MM-DD" (data, sem fuso)
  status: StatusContaPagar;
  pagoEm: number | null;
  recorrente: boolean;
  observacao: string | null;
  criadoEm: number;
}

export interface Movimento {
  id: string;
  produtoId: string;
  tipo: TipoMovimento;
  qtd: number;
  motivo: string;
  data: number;
  refVendaId?: string;
}

export interface Membro {
  id: string;
  nome: string | null;
  email: string | null;
  role: Role;
}

export interface Entrega {
  id: string;
  vendaId: string | null;
  motoboyId: string | null;
  clienteNome: string | null;
  endereco: string | null;
  telefone: string | null;
  taxa: number;
  status: StatusEntrega;
  observacao: string | null;
  criadaEm: number;
  entregueEm: number | null;
}

export interface Config {
  nomeLoja: string;
  segmento: string;
  categorias: string[];
  canais: Canal[];
  usaRevendedoras: boolean;
  margemPadrao: number;
  comissaoPadrao: number;
  onboardingCompleto: boolean;
  corMarca: string | null;
  temaBase: string | null;
  appFonte: string | null;
  appRaio: string | null;
  logoUrl: string | null;
  plano: Plano;
  slug: string | null;
  lojaAtiva: boolean;
  lojaDescricao: string | null;
  lojaCapaUrl: string | null;
  lojaFonte: string | null;
  lojaSobre: string | null;
  lojaEmail: string | null;
  lojaWhatsapp: string | null;
  lojaTelefone: string | null;
  lojaInstagram: string | null;
  lojaFacebook: string | null;
  lojaTiktok: string | null;
}

export type TipoChamado = "erro" | "duvida" | "sugestao";
export type StatusChamado = "aberto" | "resolvido";

export interface Chamado {
  id: string;
  orgId: string | null;
  usuarioId: string | null;
  nomeLoja: string | null;
  emailContato: string | null;
  whatsapp: string | null;
  tipo: TipoChamado;
  assunto: string;
  mensagem: string;
  status: StatusChamado;
  criadoEm: number;
  resolvidoEm: number | null;
}

export interface Conversa {
  id: string;
  clienteId: string;
  clienteNome: string | null;
  criadaEm: number;
  ultimaEm: number;
}

export interface Mensagem {
  id: string;
  conversaId: string;
  autorId: string;
  autorTipo: "cliente" | "loja";
  texto: string;
  criadaEm: number;
}
