import { NextResponse } from "next/server";
import { enviarMetricas, registrarEvento } from "@/lib/metricas/servidor";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { capacidades, limiteDoRecurso, type Assinatura, type PlanoId } from "@/lib/plans";

// Cria/remove membros (vendedor, motoboy) com login+senha definidos pelo admin.
// Usa a service_role (somente servidor) p/ criar usuários no Auth, mas SÓ depois
// de confirmar que quem chama é o dono (owner) da org.

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function donoDaOrg() {
  const sb = createServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: eu } = await sb
    .from("usuario")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu || eu.role !== "owner") return null;
  return { userId: user.id, orgId: eu.org_id as string };
}

export async function POST(req: Request) {
  const dono = await donoDaOrg();
  if (!dono) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const nome = typeof body?.nome === "string" ? body.nome.trim() || null : null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const senha = typeof body?.senha === "string" ? body.senha : "";
  const role = body?.role;
  if (!email || !senha || senha.length < 6)
    return NextResponse.json({ erro: "E-mail e senha (mín. 6) obrigatórios" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ erro: "E-mail inválido" }, { status: 400 });
  // whitelist: convite só cria papéis internos NÃO-dono (nunca owner/superadmin).
  // O banco reforça isso em private.vincular_convite (0035).
  if (role !== "vendedor" && role !== "motoboy")
    return NextResponse.json({ erro: "Papel inválido" }, { status: 400 });

  // checagem de plano ANTES de criar o usuário (evita órfão + dá erro amigável)
  const { data: a } = await admin()
    .from("assinatura")
    .select("plano, status, preco_centavos, periodo, data_inicio, data_fim, trial_ate")
    .eq("org_id", dono.orgId)
    .maybeSingle();
  const assinatura: Assinatura | null = a
    ? {
        plano: a.plano as PlanoId,
        status: a.status,
        precoCentavos: a.preco_centavos ?? 0,
        periodo: a.periodo ?? "mensal",
        dataInicio: a.data_inicio ? new Date(a.data_inicio).getTime() : null,
        dataFim: a.data_fim ? new Date(a.data_fim).getTime() : null,
        trialAte: a.trial_ate ? new Date(a.trial_ate).getTime() : null,
      }
    : null;
  const caps = capacidades(assinatura);
  if ((role === "vendedor" && !caps.allowVendedores) || (role === "motoboy" && !caps.allowMotoboys))
    return NextResponse.json(
      { erro: `Seu plano não permite criar ${role === "vendedor" ? "vendedores" : "motoboys"}. Faça upgrade.` },
      { status: 403 }
    );

  // limite de vendedores do plano (Equipe = 3): erro amigável antes de criar o órfão
  if (role === "vendedor") {
    const limite = limiteDoRecurso(caps, "vendedores");
    if (Number.isFinite(limite)) {
      const { count } = await admin()
        .from("usuario")
        .select("id", { count: "exact", head: true })
        .eq("org_id", dono.orgId)
        .eq("role", "vendedor");
      if ((count ?? 0) >= limite)
        return NextResponse.json(
          { erro: `Seu plano permite até ${limite} vendedores. Faça upgrade para adicionar mais.` },
          { status: 403 }
        );
    }
  }

  // Trade-off consciente (fluxo do produto: o dono cria o login do funcionário e
  // entrega a senha pessoalmente): usamos createUser com email_confirm: true em vez
  // de inviteUserByEmail. inviteUserByEmail exigiria o funcionário abrir o e-mail
  // e definir a senha, quebrando o fluxo "dono cadastra e entrega a senha".
  // Mitigações: (1) e-mail que já existe no Auth é recusado (o GoTrue não
  // sobrescreve conta existente) - ninguém "toma" uma conta alheia por aqui;
  // (2) org_id/role vão no app_metadata (só a service_role grava), com papel
  // fixo em vendedor/motoboy; (3) o dono só pode excluir contas da própria loja.
  // Risco residual: o dono consegue registrar um e-mail de terceiro que ainda não
  // tem conta (o terceiro pode recuperar a conta via "esqueci a senha").
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    // user_metadata NÃO dá permissão: `convite` só evita que o trigger crie loja nova.
    user_metadata: { nome, convite: true },
    // vínculo real com a loja: só a service_role grava app_metadata
    app_metadata: { org_id: dono.orgId, role },
  });
  if (error)
    return NextResponse.json(
      {
        erro: /already|exists|registered/i.test(error.message)
          ? "E-mail já cadastrado"
          : /papel_nao_permitido|limite_vendedores/i.test(error.message)
            ? "Seu plano não permite adicionar este membro. Faça upgrade."
            : error.message,
      },
      { status: 400 }
    );

  // confere que o trigger vinculou o membro à loja; senão desfaz o login órfão
  const { data: vinculo, error: eVinc } = await admin()
    .from("usuario")
    .select("id, org_id, role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (eVinc || !vinculo || vinculo.org_id !== dono.orgId || vinculo.role !== role) {
    await admin().auth.admin.deleteUser(data.user.id).catch(() => {});
    return NextResponse.json({ erro: "Não foi possível vincular o membro à loja. Tente novamente." }, { status: 500 });
  }

  registrarEvento("feature_used", dono.orgId, { feature: "membro_equipe_criado" });
  await enviarMetricas();
  return NextResponse.json({
    membro: { id: data.user.id, nome: nome ?? null, email, role },
  });
}

export async function DELETE(req: Request) {
  const dono = await donoDaOrg();
  if (!dono) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const { id } = await req.json().catch(() => ({}));
  if (!id || id === dono.userId)
    return NextResponse.json({ erro: "ID inválido" }, { status: 400 });

  // garante que o alvo pertence à mesma org antes de excluir
  const sbAdmin = admin();
  const { data: alvo } = await sbAdmin
    .from("usuario")
    .select("org_id")
    .eq("id", id)
    .maybeSingle();
  if (!alvo || alvo.org_id !== dono.orgId)
    return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });

  const { error } = await sbAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
