import type { NextConfig } from "next";

const nextConfig: NextConfig =
  process.env.NEXT_OUTPUT === "export"
    ? { output: "export" }
    : {
        async headers() {
          return [
            {
              source: '/api/:path*',
              headers: [
                { key: 'Access-Control-Allow-Origin', value: '*' },
                { key: 'Access-Control-Allow-Methods', value: 'POST, GET, OPTIONS' },
                { key: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' },
              ],
            },
          ]
        },
      };

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
