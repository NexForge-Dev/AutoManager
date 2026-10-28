// ============================================================================
// FONTE ÚNICA DE VERDADE dos planos e limites do AutoManager.
// Toda a aplicação (UI, guards, telas) consome daqui. As regras de banco
// (supabase/migrations/0013) espelham estes limites para enforcement real.
// ============================================================================

export type PlanoId = "ambulante" | "solo" | "equipe" | "expansao";
export type StatusAssinatura = "trialing" | "active" | "past_due" | "canceled";

export interface Assinatura {
  plano: PlanoId;
  status: StatusAssinatura;
  precoCentavos: number;
  periodo: string;
  dataInicio: number | null;
  dataFim: number | null;
  trialAte: number | null;
}

export interface PlanoDef {
  id: PlanoId;
  nome: string;
  precoCentavos: number;
  publico: string;
  destaque?: boolean; // "Mais vendido"
  // ---- limites / permissões (consumidos em todo lugar) ----
  maxRevendedoras: number; // Infinity = ilimitado
  allowVendedores: boolean;
  allowMotoboys: boolean;
  allowEntregas: boolean;
  allowChat: boolean;
  allowRanking: boolean;
  allowAnalytics: boolean; // analytics de vendas (canal/produto)
  allowAdvancedAnalytics: boolean; // tendência + ruptura de estoque
  beneficios: string[];
  bloqueios: string[];
}

export const PLANOS: Record<PlanoId, PlanoDef> = {
  ambulante: {
    id: "ambulante",
    nome: "Ambulante",
    precoCentavos: 2000,
    publico: "Vendedor ambulante / na rua",
    maxRevendedoras: 0,
    allowVendedores: false,
    allowMotoboys: false,
    allowEntregas: false,
    allowChat: true,
    allowRanking: false,
    allowAnalytics: false,
    allowAdvancedAnalytics: false,
    beneficios: [
      "Controle de estoque",
      "Vendas em 1 toque",
      "Lojinha virtual + chat",
      "Relatórios básicos",
    ],
    bloqueios: ["Sem revendedoras", "Sem vendedores internos", "Sem motoboys/entregas", "Sem analytics/ranking"],
  },
  solo: {
    id: "solo",
    nome: "Solo",
    precoCentavos: 4900,
    publico: "Lojista individual",
    maxRevendedoras: 3,
    allowVendedores: false,
    allowMotoboys: false,
    allowEntregas: false,
    allowChat: true,
    allowRanking: false,
    allowAnalytics: false,
    allowAdvancedAnalytics: false,
    beneficios: [
      "Estoque completo",
      "Vendas em 1 toque",
      "Loja online + chat",
      "Até 3 revendedoras",
      "Relatórios básicos",
    ],
    bloqueios: ["Sem vendedores internos", "Sem motoboys/entregas", "Sem analytics avançado", "Sem ranking"],
  },
  equipe: {
    id: "equipe",
    nome: "Equipe",
    precoCentavos: 9900,
    publico: "Lojas em crescimento",
    destaque: true,
    maxRevendedoras: 15,
    allowVendedores: true,
    allowMotoboys: false,
    allowEntregas: false,
    allowChat: true,
    allowRanking: true,
    allowAnalytics: true,
    allowAdvancedAnalytics: false,
    beneficios: [
      "Tudo do Solo",
      "Vendedores internos",
      "Até 15 revendedoras",
      "Comissão automática + ranking",
      "Analytics de vendas",
      "Chat em tempo real",
    ],
    bloqueios: ["Sem motoboys/entregas", "Sem tendência/ruptura"],
  },
  expansao: {
    id: "expansao",
    nome: "Expansão",
    precoCentavos: 19900,
    publico: "Operações estruturadas",
    maxRevendedoras: Infinity,
    allowVendedores: true,
    allowMotoboys: true,
    allowEntregas: true,
    allowChat: true,
    allowRanking: true,
    allowAnalytics: true,
    allowAdvancedAnalytics: true,
    beneficios: [
      "Tudo do Equipe",
      "Motoboys + entregas",
      "Revendedoras ilimitadas",
      "Analytics completo (tendência + ruptura)",
      "Suporte prioritário",
    ],
    bloqueios: [],
  },
};

export const ORDEM_PLANOS: PlanoId[] = ["ambulante", "solo", "equipe", "expansao"];

export function planoDef(id: PlanoId | string | null | undefined): PlanoDef {
  return PLANOS[(id as PlanoId) ?? "solo"] ?? PLANOS.solo;
}

export function brlPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

// ---- trial / plano efetivo ----
export function trialAtivo(a: Assinatura | null): boolean {
  return !!a && a.status === "trialing" && !!a.trialAte && a.trialAte > Date.now();
}

export function diasDeTrial(a: Assinatura | null): number {
  if (!trialAtivo(a) || !a?.trialAte) return 0;
  return Math.max(0, Math.ceil((a.trialAte - Date.now()) / 86_400_000));
}

// Carência após o fim do ciclo pago (data_fim) antes de cair no piso — cobre o
// atraso normal da cobrança recorrente do Mercado Pago. Espelha o "3 days" de
// private.plano_efetivo (migration 0035).
export const CARENCIA_PAGAMENTO_MS = 3 * 86_400_000;

// Durante o trial valem as capacidades de EXPANSAO.
// Espelha private.plano_efetivo (supabase/migrations/0035).
export function planoEfetivo(a: Assinatura | null): PlanoId {
  // sem assinatura carregada: assume o mais restritivo (o banco enforça de qualquer jeito)
  if (!a) return "ambulante";
  // parou de pagar (cancelado/inadimplente): perde as capacidades, cai no piso
  if (a.status === "canceled" || a.status === "past_due") return "ambulante";
  // trial: vigente = EXPANSAO; vencido sem pagamento = piso (não mantém plano pago)
  if (a.status === "trialing") return trialAtivo(a) ? "expansao" : "ambulante";
  // ativa, mas o ciclo pago venceu (e passou a carência) sem renovação = inadimplente
  if (a.status === "active" && a.dataFim && a.dataFim + CARENCIA_PAGAMENTO_MS < Date.now())
    return "ambulante";
  return a.plano;
}

export function capacidades(a: Assinatura | null): PlanoDef {
  return planoDef(planoEfetivo(a));
}

// ---- uso x limite (tela administrativa / guards) ----
export interface UsoRecursos {
  revendedoras: number;
  vendedores: number;
  motoboys: number;
}

export type Recurso = "revendedoras" | "vendedores" | "motoboys";

export function limiteDoRecurso(caps: PlanoDef, r: Recurso): number {
  if (r === "revendedoras") return caps.maxRevendedoras;
  // vendedores: Equipe tem teto de 3; Expansão ilimitado; demais bloqueado
  if (r === "vendedores") return caps.allowVendedores ? (caps.id === "equipe" ? 3 : Infinity) : 0;
  // motoboys: booleano (0 = bloqueado, Infinity = liberado)
  return caps.allowMotoboys ? Infinity : 0;
}

export function atingiuLimite(uso: UsoRecursos, caps: PlanoDef, r: Recurso): boolean {
  return uso[r] >= limiteDoRecurso(caps, r);
}

export function fmtLimite(n: number): string {
  return n === Infinity ? "∞" : String(n);
}

// Menor plano que libera um recurso/feature - usado nos CTAs de upgrade.
export function planoQueLibera(check: (p: PlanoDef) => boolean): PlanoDef | null {
  for (const id of ORDEM_PLANOS) {
    if (check(PLANOS[id])) return PLANOS[id];
  }
  return null;
}
