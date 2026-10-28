import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // arquivos estáticos (ícones, imagens, manifest, robots, sitemap, og) não passam pelo middleware
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|robots.txt|sitemap.xml|opengraph-image|.*\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
