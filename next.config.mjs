/** @type {import('next').NextConfig} */
const nextConfig = {
  // The landing page is a hand-built static page (public/landing/index.html) served at "/".
  async rewrites() { return { beforeFiles: [{ source: "/", destination: "/landing/index.html" }] }; },
  async headers() { return [{ source: "/game/index.html", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] }]; },
};
export default nextConfig;
