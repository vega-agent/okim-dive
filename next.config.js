/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server runtime (auth, API routes, DB) — no static export.
  // Portability rule (MVP-SPEC §2): host swap must stay a config change.
  eslint: { ignoreDuringBuilds: false },
  // M3: include the seed JSON files in the server bundle so the trips
  // fallback (src/lib/trips.ts) works on hosted deployments too.
  experimental: {
    serverComponentsExternalPackages: ['ws', '@neondatabase/serverless'],
    outputFileTracingIncludes: {
      '/trips': ['./data/trips/**'],
    },
  },
}

module.exports = nextConfig
