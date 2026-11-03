import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Foto do produto enviada pelo formulário (server action): o padrão do
  // Next é 1 MB; a Vercel corta em ~4,5 MB, então ficamos um pouco abaixo.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
