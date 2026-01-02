/** @type {import('next').NextConfig} */
import { z } from "zod";

// Validate environment variables at build/start time
const envSchema = z.object({
  DATABASE_HOST: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_NAME: z.string().min(1),
  // REDIS_URL is required for rate limiting and queues
  REDIS_URL: z.string().url(),
  // JWT_SECRET is required for auth
  JWT_SECRET: z.string().min(1),
});

// Only validate in production or when not in build phase to allow building without all envs if needed?
// Usually for production builds we want strict validation.
if (process.env.NODE_ENV === "production") {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.format());
    // process.exit(1); // Don't exit here, let the build fail naturally or throw error
    throw new Error("Invalid environment variables");
  }
}

const nextConfig = {
    output: "standalone",
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
            {
                protocol: "http",
                hostname: "localhost",
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

export default nextConfig;
