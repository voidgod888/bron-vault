/** @type {import('next').NextConfig} */
import { z } from "zod";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

// Validate environment variables
// We export this logic to use it conditionally
const validateEnv = () => {
  const envSchema = z.object({
    DATABASE_HOST: z.string().min(1),
    DATABASE_USER: z.string().min(1),
    DATABASE_NAME: z.string().min(1),
    // REDIS_URL is required for rate limiting and queues
    REDIS_URL: z.string().url(),
    // JWT_SECRET is required for auth
    JWT_SECRET: z.string().min(1),
  });

  if (process.env.NODE_ENV === "production") {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error("❌ Invalid environment variables:", parsed.error.format());
      throw new Error("Invalid environment variables");
    }
  }
};

export default (phase) => {
  // Skip validation during the build phase (e.g. Docker build)
  // because we don't want to bake secrets into the image.
  if (phase !== PHASE_PRODUCTION_BUILD) {
    validateEnv();
  }

  const nextConfig = {
    output: "standalone",
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        domains: ["localhost"],
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
    },
    experimental: {
        serverComponentsExternalPackages: ["telegram"],
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on'
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload'
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin'
                    }
                ]
            }
        ];
    },
    webpack: (config, { isServer }) => {
        // Fix for gramjs/telegram
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
            child_process: false,
            "aws-crt": false, // Fix for "cannot resolve aws-crt"
        };

        // Suppress specific warnings from gramjs/telegram
        config.ignoreWarnings = [
            { module: /node_modules\/telegram\/.*\.js/ },
            { module: /node_modules\/@aws-sdk\/.*\.js/ }
        ];

        return config;
    },
  };

  return nextConfig;
};
