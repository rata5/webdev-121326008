// The environment the app needs (Exercise 4, step 1). Each test passes its own variables,
// so nothing here depends on your .env.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadConfig } = require('../src/config.js');

const env = { DATABASE_URL: 'postgresql://user:password@localhost/labs', SESSION_SECRET: 'a'.repeat(64) };

describe('configuration', () => {
  it('stops with a message naming SESSION_SECRET when it is missing or empty', () => {
    for (const SESSION_SECRET of [undefined, '']) {
      expect(() => loadConfig({ ...env, SESSION_SECRET })).toThrow('Missing environment variable: SESSION_SECRET');
    }
  });

  it('stops with a message naming DATABASE_URL, and every variable that is missing', () => {
    expect(() => loadConfig({ SESSION_SECRET: env.SESSION_SECRET })).toThrow('Missing environment variable: DATABASE_URL');
    expect(() => loadConfig({})).toThrow('Missing environment variables: DATABASE_URL, SESSION_SECRET');
  });

  it('refuses the placeholder secret from .env.example', () => {
    expect(() => loadConfig({ ...env, SESSION_SECRET: 'change-me' })).toThrow('placeholder');
  });

  it('reads the port and NODE_ENV, with defaults when they are not set', () => {
    expect(loadConfig(env)).toMatchObject({ port: 3000, production: false, sessionSecret: env.SESSION_SECRET });
    expect(loadConfig({ ...env, PORT: '10000', NODE_ENV: 'production' })).toMatchObject({ port: 10000, production: true });
  });
});