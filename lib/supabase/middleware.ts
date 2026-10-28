import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
        setAll(cookiesToSet) {
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
  const rotaPublica =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/acesso") || // ativação/login self-service da revendedora
    path.startsWith("/loja") || // vitrine pública da loja
    path.startsWith("/redefinir-senha") || // link de recuperação de senha
    path.startsWith("/termos") ||
    path.startsWith("/privacidade") ||
    path.startsWith("/cancelamento") ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path.startsWith("/opengraph-image");
  // rotas de API se auto-protegem (retornam JSON 403); não devem ser redirecionadas
  // para /login. Em especial, o webhook do Mercado Pago chega sem sessão.
  const isApi = path.startsWith("/api");
  const isAsset =
    path.startsWith("/_next") ||
    path.startsWith("/manifest") ||
    path.startsWith("/icon") ||
    path.startsWith("/apple-touch-icon") ||
    path.startsWith("/favicon") ||
    path === "/favicon.ico";

  if (!user && !rotaPublica && !isApi && !isAsset) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
