// Content-Security-Policy. O Supabase (REST, Auth, Storage e Realtime via wss) é
// a única origem externa de dados; o Stripe Checkout/Portal é redirecionamento de
// página inteira (não precisa de liberação aqui). As Google Fonts da vitrine são
// carregadas sob demanda (lib/fontes.ts). 'unsafe-inline' em script-src é exigido
// pelos scripts inline do Next (hidratação) e pelo anti-flash do tema (app/layout.tsx)
// enquanto não usamos nonce (nonce força renderização dinâmica de todas as páginas).
function supabaseOrigens() {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    return { http: u.origin, ws: `${u.protocol === "http:" ? "ws:" : "wss:"}//${u.host}` };
  } catch {
    return { http: "https://*.supabase.co", ws: "wss://*.supabase.co" };
  }
}

function contentSecurityPolicy() {
  const sb = supabaseOrigens();
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${sb.http}`,
    `connect-src 'self' ${sb.http} ${sb.ws}${dev ? " ws:" : ""}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // o app não usa next/image: desliga o otimizador (reduz superfície de ataque do /_next/image)
  images: { unoptimized: true },
  experimental: {
    // Tree-shaking de libs com muitos exports nomeados -> bundles bem menores.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
