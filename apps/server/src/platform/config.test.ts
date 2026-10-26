import { describe, expect, it } from 'vitest';

import { bootConfig } from './config.js';

const VALID_ENV = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/metaverse?replicaSet=rs0',
  REDIS_URL: 'redis://127.0.0.1:6379',
  WEB_ORIGIN: 'http://localhost:5173',
  ASSET_BASE_URL: 'http://localhost:3000/assets',
  JWT_ISSUER: 'metaverse-local',
} as const;

class ExitSignal extends Error {
  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}

function boot(env: Record<string, string | undefined>): {
  exitCode: number | undefined;
  stderr: string;
} {
  let exitCode: number | undefined;
  let stderr = '';
  try {
    bootConfig({
      env,
      writeError: (text) => {
        stderr += text;
      },
      exit: (code) => {
        exitCode = code;
        throw new ExitSignal(code);
      },
    });
  } catch (err) {
    if (!(err instanceof ExitSignal)) {
      throw err;
    }
  }
  return { exitCode, stderr };
}

describe('bootConfig', () => {
  it('returns the config and writes nothing when the environment is valid', () => {
    let stderr = '';

    const config = bootConfig({
      env: VALID_ENV,
      writeError: (text) => {
        stderr += text;
      },
      exit: () => {
        throw new Error('exit must not be called');
      },
    });

    expect(config.webOrigin).toBe(VALID_ENV.WEB_ORIGIN);
    expect(stderr).toBe('');
  });

  it('exits non-zero and prints the variable name when MONGODB_URI is missing', () => {
    const env: Record<string, string | undefined> = { ...VALID_ENV, MONGODB_URI: undefined };

    const { exitCode, stderr } = boot(env);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('MONGODB_URI');
  });

  it('never prints the values of other variables', () => {
    const env = {
      ...VALID_ENV,
      MONGODB_URI: undefined,
      JWT_ISSUER: 'issuer-value-that-must-not-leak',
    };

    const { stderr } = boot(env);

    expect(stderr).not.toContain('issuer-value-that-must-not-leak');
    expect(stderr).not.toContain(VALID_ENV.REDIS_URL);
  });

  it('exits non-zero with a readable error when WEB_ORIGIN is not a URL', () => {
    const { exitCode, stderr } = boot({ ...VALID_ENV, WEB_ORIGIN: 'nope' });

    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/WEB_ORIGIN: .*URL/i);
  });

  it('rethrows unexpected errors instead of swallowing them', () => {
    const throwingEnv = new Proxy(
      {},
      {
        get: () => {
          throw new Error('boom');
        },
        ownKeys: () => {
          throw new Error('boom');
        },
      },
    ) as Record<string, string | undefined>; // Proxy stands in for an env source that fails on access

    expect(() =>
      bootConfig({
        env: throwingEnv,
        writeError: () => undefined,
        exit: () => {
          throw new Error('exit must not be called');
        },
      }),
    ).toThrow('boom');
  });
});
