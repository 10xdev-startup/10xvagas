import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O checker pela API evita subprocesso extra e usa o mesmo TypeScript do workspace.
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;
