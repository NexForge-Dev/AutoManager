import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { enviarMetricas, registrarEvento } from "@/lib/metricas/servidor";

// Recebe os sinais do navegador para o Painel NexForge (métricas internas).
// Nunca confia no navegador para identidade: a loja vem da sessão; o cadastro
// é conferido no Supabase Auth. Sempre responde 204 (não revela nada).

const RECURSOS = new Set([
  "produto_cadastrado",
  "venda_registrada",
  "revendedora_adicionada",
  "venda_revendedora",
  "loja_online_publicada",
  "chat_vitrine_respondido",
  "recebimento_confirmado",
  "conta_a_pagar",
  "reposicao_consultada",
  "entrega_criada",
  "analytics_visto",
  "relatorio_exportado",
]);
const ETAPAS = new Set(["loja", "segmento", "plano", "revendedoras", "margem", "contato"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Um cadastro só conta enquanto é recente: um id conhecido não pode ser reaproveitado depois.
const JANELA_CADASTRO_MS = 30 * 60 * 1000;

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const vazio = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo || typeof corpo.tipo !== "string") return vazio();

  try {
    if (corpo.tipo === "cadastro") {
      if (typeof corpo.userId !== "string" || !UUID.test(corpo.userId)) return vazio();
      const sb = admin();
      const { data } = await sb.auth.admin.getUserById(corpo.userId);
      const criado = data?.user ? Date.parse(data.user.created_at) : NaN;
      if (!(Date.now() - criado < JANELA_CADASTRO_MS)) return vazio();
      // A loja é criada pelo trigger handle_new_user junto com o usuário.
      const { data: eu } = await sb.from("usuario").select("org_id, role").eq("id", corpo.userId).maybeSingle();
      if (eu?.role === "owner") registrarEvento("signup_started", eu.org_id, { method: "email" }, "cadastro");
      await enviarMetricas();
      return vazio();
    }

    const sb = createServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return vazio();
    const { data: eu } = await sb.from("usuario").select("org_id, role").eq("id", user.id).maybeSingle();
    const orgId = eu?.org_id as string | undefined;
    if (!orgId) return vazio();
    const dono = eu?.role === "owner";

    switch (corpo.tipo) {
      case "sessao":
        registrarEvento("session_started", orgId);
        // Entrar implica e-mail confirmado: o primeiro login do dono conclui o cadastro.
        if (dono) registrarEvento("signup_completed", orgId, { method: "email" }, "cadastro");
        break;
      case "recurso": {
        if (typeof corpo.recurso !== "string" || !RECURSOS.has(corpo.recurso)) break;
        const q = Number(corpo.quantidade);
        registrarEvento("feature_used", orgId, Number.isInteger(q) && q > 1 && q <= 100000 ? { feature: corpo.recurso, quantity: q } : { feature: corpo.recurso });
        break;
      }
      case "etapa":
        if (dono && typeof corpo.etapa === "string" && ETAPAS.has(corpo.etapa)) {
          registrarEvento("signup_step_completed", orgId, { step: corpo.etapa }, `etapa:${corpo.etapa}`);
        }
        break;
      case "onboarding":
        if (dono) registrarEvento("onboarding_completed", orgId, {}, "onboarding");
        break;
      case "planos_vistos":
        if (dono) registrarEvento("plan_viewed", orgId);
        break;
    }
    await enviarMetricas();
  } catch {
    // Métricas nunca derrubam nada.
  }
  return vazio();
}
