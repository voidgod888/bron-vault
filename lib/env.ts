import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_HOST: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().optional(),
  DATABASE_NAME: z.string().min(1),
  DATABASE_PORT: z.string().optional(),

  // Redis
  REDIS_URL: z.string().url(),

  // Auth
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  NEXT_PUBLIC_ENABLE_AUTH: z.string().optional().default('true'),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

// Validate `process.env` and throw if invalid
const env = envSchema.parse(process.env)

export default env
