import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { AUTH_BODY_LIMIT, readCredentials } = require('../../../server/auth-validation.cjs');

it('accepts normal credentials and preserves the password and salt exactly', () => {
  expect(readCredentials({ email: ' Test@Example.com ', password: ' пароль 123 ', salt: 'abc+/=' }, true))
    .toEqual({ email: 'test@example.com', password: ' пароль 123 ', salt: 'abc+/=' });
  expect(AUTH_BODY_LIMIT).toBe(16 * 1024);
});

it('rejects malformed credentials before hashing or querying', () => {
  for (const body of [null, [], 'text', {}, { email: 'x@example.com', password: 12345678 },
    { email: 'x@example.com', password: ['password'] }, { email: 'x@example.com', password: 'password', salt: {} },
    { email: 'not-an-email', password: 'password', salt: 'salt' }]) {
    expect(readCredentials(body, true)).toBeNull();
  }
  expect(readCredentials({ email: 'x@example.com', password: 'password', salt: 3 })).not.toBeNull();
  expect(readCredentials({ email: 'x@example.com', password: '' })).toBeNull();
});
