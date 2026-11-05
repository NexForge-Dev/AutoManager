import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { FEEDBACK_MAX, KIND_FEEDBACK, validarFeedback } from "@/lib/feedback";
import { enviarFeedback } from "@/lib/metricas/servidor";
import { LIMITE_FEEDBACK, chaveLimite, dentroDoLimite } from "@/lib/rateLimit";

// Balão de feedback e card de suporte: grava em `chamado` com a sessão do usuário
// (RLS) e só depois repassa ao Painel NexForge. Uma falha do painel nunca derruba o
// pedido, e ele nunca recebe nome, e-mail ou id do usuário.

export async function POST(req: Request) {
  const sb = await createServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  // a sessão anônima do chat da vitrine não é login de verdade
  if (!user || user.is_anonymous) return NextResponse.json({ erro: "Sessão expirada. Entre novamente." }, { status: 401 });

  const v = validarFeedback(await req.json().catch(() => null));
  if (!v.ok) return NextResponse.json({ erro: v.erro }, { status: 400 });
  const { tipo, mensagem, assunto, assuntoDigitado, pagina, emailContato } = v.dados;

  // rate_limit_registrar só roda com a service_role (0038)
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (!(await dentroDoLimite(admin, chaveLimite("feedback:usuario", user.id), LIMITE_FEEDBACK)))
    return NextResponse.json(
      { erro: "Você enviou muitas mensagens. Tente de novo em até 1 hora." },
      { status: 429, headers: { "Retry-After": String(LIMITE_FEEDBACK.janelaSegundos) } }
    );

  const { data: eu } = await sb.from("usuario").select("org_id").eq("id", user.id).maybeSingle();
  const orgId = (eu?.org_id as string | undefined) ?? null;
  const { data: org } = orgId ? await sb.from("org").select("nome").eq("id", orgId).maybeSingle() : { data: null };

  // id gerado aqui: pela RLS só o superadmin lê `chamado`, então um insert com
  // .select() do usuário comum falharia
  const id = randomUUID();
  const { error } = await sb.from("chamado").insert({
    id,
    org_id: orgId,
    usuario_id: user.id,
    nome_loja: org?.nome || null,
    email_contato: emailContato || user.email || null,
    tipo,
    assunto,
    mensagem,
  });
  if (error) {
    console.error("[feedback] falha ao gravar chamado:", error.message);
    return NextResponse.json({ erro: "Não foi possível enviar. Tente de novo." }, { status: 500 });
  }

  await enviarFeedback({
    externalId: id,
    kind: KIND_FEEDBACK[tipo],
    // o painel não tem campo de assunto: o que foi digitado vai junto do texto
    message: (assuntoDigitado ? `${assuntoDigitado}\n\n${mensagem}` : mensagem).slice(0, FEEDBACK_MAX),
    page: pagina,
    occurredAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
