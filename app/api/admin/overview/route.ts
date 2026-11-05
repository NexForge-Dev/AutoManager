import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { ehSuperadminUser } from "@/lib/admin";
import { CARENCIA_PAGAMENTO_MS, PLANOS, type PlanoId } from "@/lib/plans";

// Visão geral da PLATAFORMA (super-admin): todas as lojas, planos e faturamento.
// Lê tudo com a service_role (ignora RLS), mas SÓ depois de confirmar que quem
// chama é o super-admin do AutoManager (app_metadata.role).

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function exigirSuperadmin() {
  const sb = await createServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  // papel no app_metadata (só a service_role grava) - não mais pelo e-mail
  if (!ehSuperadminUser(user)) return null;
  return user;
}

const PLANOS_IDS: PlanoId[] = ["ambulante", "solo", "equipe", "expansao"];

// Busca as orgs tolerando a ausência da coluna `acesso` (migration 0025 ainda
// não aplicada). Sem ela, todas as lojas contam como 'ativo'.
async function buscarOrgs(a: ReturnType<typeof admin>): Promise<any[]> {
  const comAcesso = await a.from("org").select("id, nome, slug, acesso");
  if (!comAcesso.error) return comAcesso.data ?? [];
  const sem = await a.from("org").select("id, nome, slug");
  if (sem.error) throw sem.error;
  return sem.data ?? [];
}

export async function GET() {
  const su = await exigirSuperadmin();
  if (!su) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const a = admin();
  let orgs: any[];
  let assinaturas: any[] | null;
  let usuarios: any[] | null;
  try {
    const [o, s, u] = await Promise.all([
      buscarOrgs(a),
      a.from("assinatura").select("org_id, plano, status, preco_centavos, trial_ate, data_inicio, data_fim, provider, created_at"),
      a.from("usuario").select("email, role, org_id"),
    ]);
    if (s.error || u.error) throw s.error || u.error;
    orgs = o;
    assinaturas = s.data;
    usuarios = u.data;
  } catch (e) {
    // leitura que falhou não pode virar "0 lojas, MRR R$ 0,00": a tela mostra o erro
    console.error("[admin/overview]", e);
    return NextResponse.json({ erro: "Falha ao ler os dados da plataforma" }, { status: 500 });
  }

  const assinByOrg = new Map<string, any>();
  for (const s of assinaturas ?? []) assinByOrg.set(s.org_id, s);

  const ownerByOrg = new Map<string, string>();
  const membrosByOrg = new Map<string, number>();
  for (const u of usuarios ?? []) {
    if (!u.org_id) continue;
    membrosByOrg.set(u.org_id, (membrosByOrg.get(u.org_id) ?? 0) + 1);
    if (u.role === "owner" && u.email) ownerByOrg.set(u.org_id, u.email);
  }

  const agora = Date.now();
  const lojas = (orgs ?? []).map((o) => {
    const s = assinByOrg.get(o.id);
    const plano = (s?.plano ?? "solo") as PlanoId;
    // status "de verdade" (espelha planoEfetivo): trial vencido, ciclo pago vencido
    // além da carência e plano ativo sem cobrança no Stripe (cortesia do suporte)
    // não contam como assinatura paga no MRR.
    const fimPago = s?.data_fim ? new Date(s.data_fim).getTime() : null;
    let status: string = s?.status ?? "canceled";
    if (status === "trialing" && !(s?.trial_ate && new Date(s.trial_ate).getTime() > agora)) status = "trial_vencido";
    else if (status === "active" && fimPago !== null && fimPago + CARENCIA_PAGAMENTO_MS < agora) status = "past_due";
    else if (status === "active" && s?.provider !== "stripe") status = "cortesia";
    return {
      orgId: o.id,
      nome: o.nome ?? "(sem nome)",
      slug: o.slug ?? null,
      acesso: (o.acesso ?? "ativo") as "ativo" | "desativado" | "banido",
      plano,
      status,
      precoCentavos: Number(s?.preco_centavos ?? PLANOS[plano].precoCentavos),
      ownerEmail: ownerByOrg.get(o.id) ?? null,
      membros: membrosByOrg.get(o.id) ?? 0,
      desde: s?.data_inicio ?? s?.created_at ?? null,
    };
  });

  // ---- agregados de faturamento (MRR = só assinaturas ATIVAS pagas no Stripe) ----
  let mrrCentavos = 0;
  let ativas = 0;
  let trial = 0;
  let canceladas = 0;
  const porPlano: Record<PlanoId, { ativas: number; mrrCentavos: number }> = {
    ambulante: { ativas: 0, mrrCentavos: 0 },
    solo: { ativas: 0, mrrCentavos: 0 },
    equipe: { ativas: 0, mrrCentavos: 0 },
    expansao: { ativas: 0, mrrCentavos: 0 },
  };

  for (const l of lojas) {
    if (l.status === "active") {
      ativas++;
      mrrCentavos += l.precoCentavos;
      porPlano[l.plano].ativas++;
      porPlano[l.plano].mrrCentavos += l.precoCentavos;
    } else if (l.status === "trialing") {
      trial++;
    } else if (l.status === "canceled") {
      canceladas++;
    }
  }

  // ordena: ativas pagantes primeiro, depois por preço desc
  lojas.sort((x, y) => {
    if (x.status !== y.status) return x.status === "active" ? -1 : 1;
    return y.precoCentavos - x.precoCentavos;
  });

  return NextResponse.json({
    resumo: {
      totalLojas: lojas.length,
      ativas,
      trial,
      canceladas,
      mrrCentavos,
      arrCentavos: mrrCentavos * 12,
      porPlano: PLANOS_IDS.map((id) => ({
        plano: id,
        nome: PLANOS[id].nome,
        ativas: porPlano[id].ativas,
        mrrCentavos: porPlano[id].mrrCentavos,
      })),
    },
    lojas,
  });
}
