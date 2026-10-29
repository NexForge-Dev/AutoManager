import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { capacidades, type Assinatura, type PlanoId, type StatusAssinatura } from "@/lib/plans";

// Ativação self-service da revendedora: ela informa o e-mail que a loja liberou e
// escolhe a própria senha no 1º acesso. Só funciona se o dono liberou o acesso
// (acesso_liberado = true) e ela ainda não ativou (user_id null).

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  // valida os tipos: um campo não-string (ex.: número) derrubava a rota com 500
  const mail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const cod = typeof body?.codigo === "string" ? body.codigo.trim().toUpperCase() : "";
  const senha = typeof body?.senha === "string" ? body.senha : "";
  if (!mail || !senha || senha.length < 6)
    return NextResponse.json({ erro: "Informe o e-mail e uma senha de pelo menos 6 caracteres." }, { status: 400 });
  if (!cod)
    return NextResponse.json({ erro: "Informe o código de acesso que a loja enviou para você." }, { status: 400 });

  const sb = admin();

  // Mensagem única para os casos de "não elegível" (não cadastrada, não liberada,
  // código errado/expirado, plano sem revendedoras): evita que se descubra quais
  // e-mails estão cadastrados ou se um e-mail existe.
  const naoElegivel = NextResponse.json(
    { erro: "E-mail ou código inválido. Confirme com a loja o e-mail liberado e o código de acesso." },
    { status: 403 }
  );

  // revendedoras liberadas e ainda não ativadas com este e-mail (pode haver mais
  // de uma loja com o mesmo e-mail: o código decide qual).
  const { data: candidatas } = await sb
    .from("revendedora")
    .select("id, nome, org_id, acesso_liberado, user_id, ativa")
    .ilike("email", mail)
    .eq("acesso_liberado", true)
    .is("user_id", null)
    .eq("ativa", true)
    .limit(20);

  if (!candidatas || candidatas.length === 0) return naoElegivel;

  // código de convite (tabela revendedora_convite, sem acesso p/ anon/authenticated
  // — migration 0035): precisa bater e não estar expirado (uso único — apagado no fim).
  const { data: convites } = await sb
    .from("revendedora_convite")
    .select("revendedora_id, codigo, expira")
    .in(
      "revendedora_id",
      candidatas.map((c) => c.id)
    );
  const convite = (convites ?? []).find(
    (c) => (c.codigo || "").toUpperCase() === cod && new Date(c.expira).getTime() >= Date.now()
  );
  if (!convite) return naoElegivel;
  const rev = candidatas.find((c) => c.id === convite.revendedora_id);
  if (!rev) return naoElegivel;

  // o plano atual da loja inclui revendedoras? (Ambulante = 0 -> bloqueia o acesso).
  // espelha private.permite_revendedoras; evita criar login que não vai conseguir entrar.
  const { data: assin } = await sb
    .from("assinatura")
    .select("plano, status, trial_ate, data_fim")
    .eq("org_id", rev.org_id)
    .maybeSingle();
  const assinatura: Assinatura | null = assin
    ? {
        plano: assin.plano as PlanoId,
        status: assin.status as StatusAssinatura,
        precoCentavos: 0,
        periodo: "mensal",
        dataInicio: null,
        dataFim: assin.data_fim ? new Date(assin.data_fim).getTime() : null,
        trialAte: assin.trial_ate ? new Date(assin.trial_ate).getTime() : null,
      }
    : null;
  if (capacidades(assinatura).maxRevendedoras === 0) return naoElegivel;

  // cria o login. O papel 'revendedora' vai no app_metadata (só a service_role
  // grava) -> o trigger NÃO cria org/usuario. user_metadata.convite só evita que o
  // trigger trate a conta como cadastro de loja nova; não dá permissão.
  // email_confirm: true é seguro aqui: o e-mail foi cadastrado pelo dono E a
  // pessoa provou posse do código de convite de uso único. Um e-mail que já tem
  // conta no Auth é recusado pelo GoTrue (não sobrescreve conta existente).
  const { data: created, error: errCreate } = await sb.auth.admin.createUser({
    email: mail,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: rev.nome, convite: true },
    app_metadata: { role: "revendedora" },
  });
  if (errCreate) {
    const dup = /already|exists|registered/i.test(errCreate.message);
    // genérico: não confirma que o e-mail é de uma revendedora cadastrada,
    // mas ainda orienta quem já ativou a usar "Entrar".
    return NextResponse.json(
      { erro: dup ? "Se você já ativou antes, use a opção Entrar." : "Não foi possível concluir a ativação. Tente novamente." },
      { status: 400 }
    );
  }

  // vincula o login à revendedora e consome o código (uso único)
  const { error: errLink } = await sb
    .from("revendedora")
    .update({ user_id: created.user.id })
    .eq("id", rev.id);
  if (errLink) {
    // desfaz o usuário órfão se não conseguiu vincular
    await sb.auth.admin.deleteUser(created.user.id).catch(() => {});
    return NextResponse.json({ erro: "Não foi possível concluir a ativação. Tente novamente." }, { status: 500 });
  }

  // consome o código (uso único). Falha aqui não invalida a ativação: com
  // user_id preenchido a revendedora deixa de ser elegível de qualquer forma.
  const { error: errConv } = await sb.from("revendedora_convite").delete().eq("revendedora_id", rev.id);
  if (errConv) console.error("Falha ao apagar convite da revendedora", rev.id, errConv.message);

  return NextResponse.json({ ok: true });
}
