/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // o app não usa next/image: desliga o otimizador (reduz superfície de ataque do /_next/image)
  images: { unoptimized: true },
  experimental: {
    // Tree-shaking de libs com muitos exports nomeados -> bundles bem menores.
    optimizePackageImports: ["lucide-react", "recharts"],
    // habilita instrumentation.ts (validação das variáveis de ambiente na subida)
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
