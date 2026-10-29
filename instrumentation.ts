// Validação das variáveis de ambiente na subida do servidor (Next instrumentation).
// Obrigatórias faltando -> o servidor NÃO sobe (erro claro no log do deploy).
// Recomendadas faltando -> aviso no log (o app sobe, mas a função fica desligada).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const vazio = (k: string) => {
    const v = (process.env[k] ?? "").trim();
    return !v || v.startsWith("cole_aqui") || v === "..." || v.endsWith("-...");
  };

  const obrigatorias = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const faltando = obrigatorias.filter(vazio);
  if (faltando.length) {
    throw new Error(
      `[AutoManager] Variáveis de ambiente obrigatórias ausentes: ${faltando.join(", ")}. ` +
        "Veja .env.local.example e LANCAMENTO.md."
    );
  }

  if (process.env.NODE_ENV !== "production") return;

  const avisos: string[] = [];
  if (vazio("NEXT_PUBLIC_APP_URL") || /localhost|127\.0\.0\.1/.test(process.env.NEXT_PUBLIC_APP_URL ?? ""))
    avisos.push("NEXT_PUBLIC_APP_URL (domínio público https://...; usado no SEO e nas URLs do Mercado Pago)");
  if (vazio("MP_ACCESS_TOKEN")) avisos.push("MP_ACCESS_TOKEN (sem ele ninguém consegue assinar um plano)");
  if (vazio("MP_WEBHOOK_SECRET"))
    avisos.push("MP_WEBHOOK_SECRET (sem ele o webhook do Mercado Pago rejeita todas as notificações)");
  for (const a of avisos) console.error(`[AutoManager] Configuração de produção ausente: ${a}`);

  // dados da empresa exibidos nos Termos/Privacidade/rodapé (CDC + LGPD)
  const { EMPRESA } = await import("./lib/empresa");
  const empresaVazia = (["razaoSocial", "cnpj", "emailSuporte", "cidadeUf"] as const).filter((k) => !EMPRESA[k]);
  if (empresaVazia.length)
    console.error(`[AutoManager] Preencha lib/empresa.ts antes de vender: ${empresaVazia.join(", ")}`);
}
