import { describe, expect, it } from 'vitest';

import { ConfigValidationError, loadConfig } from './load-config.js';

const VALID_ENV = {
  PORT: '4000',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/metaverse?replicaSet=rs0',
  REDIS_URL: 'redis://127.0.0.1:6379',
  WEB_ORIGIN: 'http://localhost:5173',
  ASSET_BASE_URL: 'http://localhost:3000/assets',
  JWT_ISSUER: 'metaverse-local',
  LOG_LEVEL: 'debug',
} as const;

const REQUIRED_VARS = [
  'MONGODB_URI',
  'REDIS_URL',
  'WEB_ORIGIN',
  'ASSET_BASE_URL',
  'JWT_ISSUER',
] as const;

function withoutKey(key: string): Record<string, string | undefined> {
  const copy: Record<string, string | undefined> = { ...VALID_ENV };
  delete copy[key];
  return copy;
}

function failureMessage(env: Record<string, string | undefined>): string {
  try {
    loadConfig(env);
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      return err.message;
    }
    throw err;
  }
  throw new Error('expected loadConfig to throw');
}

describe('loadConfig', () => {
  it('returns a typed config object for a valid environment', () => {
    const config = loadConfig(VALID_ENV);

    expect(config).toEqual({
      port: 4000,
      mongodbURI: VALID_ENV.MONGODB_URI,
      redisURL: VALID_ENV.REDIS_URL,
      webOrigin: VALID_ENV.WEB_ORIGIN,
      assetBaseURL: VALID_ENV.ASSET_BASE_URL,
      jwtIssuer: VALID_ENV.JWT_ISSUER,
      logLevel: 'debug',
    });
  });

  it('returns a frozen object', () => {
    const config = loadConfig(VALID_ENV);

    expect(Object.isFrozen(config)).toBe(true);
  });

  it('applies defaults for PORT and LOG_LEVEL when they are absent', () => {
    const env = { ...VALID_ENV, PORT: undefined, LOG_LEVEL: undefined };

    const config = loadConfig(env);

    expect(config.port).toBe(3000);
    expect(config.logLevel).toBe('info');
  });

  it('ignores unrelated environment variables', () => {
    const env = { ...VALID_ENV, PATH: '/usr/bin', HOME: '/home/x' };

    const config = loadConfig(env);

    expect(Object.keys(config).sort()).toEqual(
      [
        'assetBaseURL',
        'jwtIssuer',
        'logLevel',
        'mongodbURI',
        'port',
        'redisURL',
        'webOrigin',
      ].sort(),
    );
  });

  it.each(REQUIRED_VARS)('fails and names the variable when %s is missing', (name) => {
    const message = failureMessage(withoutKey(name));

    expect(message).toContain(name);
    expect(message).toContain('is required');
  });

  it('reports every missing variable in one error', () => {
    const message = failureMessage({});

    for (const name of REQUIRED_VARS) {
      expect(message).toContain(name);
    }
  });

  it('never prints the values of other variables in the error', () => {
    const env = {
      ...withoutKey('MONGODB_URI'),
      JWT_ISSUER: 'issuer-value-that-must-not-leak',
      REDIS_URL: 'redis://:fake-password-not-real@127.0.0.1:6379',
    };

    const message = failureMessage(env);

    expect(message).toContain('MONGODB_URI');
    expect(message).not.toContain('issuer-value-that-must-not-leak');
    expect(message).not.toContain('fake-password-not-real');
  });

  it('fails with a readable error when WEB_ORIGIN is not a URL', () => {
    const message = failureMessage({ ...VALID_ENV, WEB_ORIGIN: 'not a url' });

    expect(message).toMatch(/WEB_ORIGIN: .*URL/i);
    expect(message).not.toContain('not a url');
  });

  it('reports at most one issue per variable', () => {
    const message = failureMessage({ ...VALID_ENV, WEB_ORIGIN: 'not a url' });

    expect(message.match(/WEB_ORIGIN/g)).toHaveLength(1);
  });

  it('fails when WEB_ORIGIN has a path, query or fragment', () => {
    const message = failureMessage({ ...VALID_ENV, WEB_ORIGIN: 'http://localhost:5173/app' });

    expect(message).toContain('WEB_ORIGIN');
    expect(message).toContain('origin');
  });

  it('fails when MONGODB_URI does not use a mongodb scheme', () => {
    const message = failureMessage({ ...VALID_ENV, MONGODB_URI: 'http://127.0.0.1:27017' });

    expect(message).toContain('MONGODB_URI');
  });

  it('fails when REDIS_URL does not use a redis scheme', () => {
    const message = failureMessage({ ...VALID_ENV, REDIS_URL: 'http://127.0.0.1:6379' });

    expect(message).toContain('REDIS_URL');
  });

  it('fails when ASSET_BASE_URL is not a URL', () => {
    const message = failureMessage({ ...VALID_ENV, ASSET_BASE_URL: '/assets' });

    expect(message).toContain('ASSET_BASE_URL');
  });

  it('fails when JWT_ISSUER is empty', () => {
    const message = failureMessage({ ...VALID_ENV, JWT_ISSUER: '' });

    expect(message).toContain('JWT_ISSUER');
  });

  it.each(['0', '65536', 'abc', '80.5'])('fails when PORT is %s', (port) => {
    const message = failureMessage({ ...VALID_ENV, PORT: port });

    expect(message).toContain('PORT');
  });

  it('fails when LOG_LEVEL is not a known level', () => {
    const message = failureMessage({ ...VALID_ENV, LOG_LEVEL: 'verbose' });

    expect(message).toContain('LOG_LEVEL');
  });

  it('exposes structured issues on the error', () => {
    let caught: unknown;
    try {
      loadConfig(withoutKey('WEB_ORIGIN'));
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ConfigValidationError);
    const error = caught as ConfigValidationError; // narrowed by the assertion above
    expect(error.issues).toEqual([{ variable: 'WEB_ORIGIN', message: 'is required' }]);
  });
});
