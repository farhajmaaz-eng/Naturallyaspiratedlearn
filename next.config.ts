import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse"],
};

export default nextConfig;
