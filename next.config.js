/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server runtime (auth, API routes, DB) — no static export.
  // Portability rule (MVP-SPEC §2): host swap must stay a config change.
  eslint: { ignoreDuringBuilds: false },
}

module.exports = nextConfig
