import { z } from 'zod';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const required = {
  error: (issue: { input?: unknown }): string | undefined =>
    issue.input === undefined ? 'is required' : undefined,
};

// scheme://authority and nothing after it (no path, query or fragment)
const ORIGIN_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]+$/i;

export const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z
    .string(required)
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
  REDIS_URL: z.url({ ...required, protocol: /^rediss?$/ }),
  WEB_ORIGIN: z
    .url(required)
    .regex(
      ORIGIN_PATTERN,
      'must be an origin (scheme://host[:port]) with no path, query or fragment',
    ),
  ASSET_BASE_URL: z.url(required),
  JWT_ISSUER: z.string(required).min(1, 'must not be empty'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export type Env = z.infer<typeof envSchema>;
