import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// telas do app (logado). Ao criar uma tela nova em app/(app), inclua aqui.
export const ROTAS_PRIVADAS = [
  "/painel",
  "/vender",
  "/produtos",
  "/reposicao",
  "/financeiro",
  "/recebimentos",
  "/relatorios",
  "/analytics",
  "/configuracoes",
  "/planos",
  "/perfil",
  "/onboarding",
  "/conversas",
  "/entregas",
  "/revendedoras",
  "/revenda",
  "/minha-loja",
  "/admin",
];

// Refresca a sessão a cada request e protege rotas privadas.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Só as telas do app exigem login. Qualquer outra URL (pública ou inexistente)
  // segue normal: as públicas renderizam e as inexistentes caem no 404, em vez
  // de mandar quem digitou um link errado para a tela de cadastro.
  // APIs se auto-protegem (retornam JSON 403); o webhook do Mercado Pago chega sem sessão.
  const rotaPrivada = ROTAS_PRIVADAS.some((r) => path === r || path.startsWith(r + "/"));

  if (!user && rotaPrivada) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
