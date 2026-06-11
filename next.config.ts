import type { NextConfig } from "next";

const nextConfig: NextConfig =
  process.env.NEXT_OUTPUT === "export"
    ? { output: "export" }
    : {};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
