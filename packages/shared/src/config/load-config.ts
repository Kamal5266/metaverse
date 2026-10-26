import { envSchema, type Env, type LogLevel } from './env-schema.js';

/** Any string-keyed source of environment variables, e.g. `process.env`. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

export type AppConfig = Readonly<{
  port: number;
  mongodbURI: string;
  redisURL: string;
  webOrigin: string;
  assetBaseURL: string;
  jwtIssuer: string;
  logLevel: LogLevel;
}>;

export type ConfigIssue = Readonly<{ variable: string; message: string }>;

/** Thrown by `loadConfig`; `message` lists variable names and reasons, never values. */
export class ConfigValidationError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super(formatConfigIssues(issues));
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

/** Renders issues as one line per variable, suitable for stderr. */
export function formatConfigIssues(issues: readonly ConfigIssue[]): string {
  const lines = issues.map((issue) => `  - ${issue.variable}: ${issue.message}`);
  return ['Invalid configuration:', ...lines].join('\n');
}

function toAppConfig(env: Env): AppConfig {
  return Object.freeze({
    port: env.PORT,
    mongodbURI: env.MONGODB_URI,
    redisURL: env.REDIS_URL,
    webOrigin: env.WEB_ORIGIN,
    assetBaseURL: env.ASSET_BASE_URL,
    jwtIssuer: env.JWT_ISSUER,
    logLevel: env.LOG_LEVEL,
  });
}

/**
 * Validates the environment against `envSchema` and returns a frozen, typed config.
 * Unknown variables are ignored. Throws `ConfigValidationError` listing every problem
 * (first issue per variable).
 */
export function loadConfig(env: EnvSource): AppConfig {
  const result = envSchema.safeParse(env);
  if (result.success) {
    return toAppConfig(result.data);
  }
  const byVariable = new Map<string, ConfigIssue>();
  for (const issue of result.error.issues) {
    const variable = issue.path.map(String).join('.');
    if (!byVariable.has(variable)) {
      byVariable.set(variable, { variable, message: issue.message });
    }
  }
  throw new ConfigValidationError([...byVariable.values()]);
}
