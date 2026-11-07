import { expect, it } from 'vitest';
import * as opaque from '@serenity-kit/opaque';
import { decryptBytes, encryptBytes } from '../cryptoExport';

// Feasibility only: this does not implement the network protocol or a migration.
it('authenticates without sending a password and can recover an existing encrypted fixture', async () => {
  await opaque.ready;
  const password = 'test-only-password-please-do-not-reuse';
  const userIdentifier = 'test@example.invalid';
  const serverSetup = opaque.server.createSetup();
  const registration = opaque.client.startRegistration({ password });
  const response = opaque.server.createRegistrationResponse({ serverSetup, userIdentifier, registrationRequest: registration.registrationRequest });
  const record = opaque.client.finishRegistration({ password, clientRegistrationState: registration.clientRegistrationState, registrationResponse: response.registrationResponse });

  const start = opaque.client.startLogin({ password });
  const challenge = opaque.server.startLogin({ serverSetup, userIdentifier, registrationRecord: record.registrationRecord, startLoginRequest: start.startLoginRequest });
  const client = opaque.client.finishLogin({ password, clientLoginState: start.clientLoginState, loginResponse: challenge.loginResponse });
  expect(client).toBeDefined();
  const server = opaque.server.finishLogin({ serverLoginState: challenge.serverLoginState, finishLoginRequest: client!.finishLoginRequest });
  expect(server.sessionKey).toBe(client!.sessionKey);
  expect(client!.exportKey).toBe(record.exportKey);
  for (const message of [registration.registrationRequest, response.registrationResponse, record.registrationRecord, start.startLoginRequest, challenge.loginResponse, client!.finishLoginRequest]) {
    expect(message).not.toContain(password);
  }

  const wrong = opaque.client.startLogin({ password: 'wrong-password' });
  const wrongChallenge = opaque.server.startLogin({ serverSetup, userIdentifier, registrationRecord: record.registrationRecord, startLoginRequest: wrong.startLoginRequest });
  expect(opaque.client.finishLogin({ password: 'wrong-password', clientLoginState: wrong.clientLoginState, loginResponse: wrongChallenge.loginResponse })).toBeUndefined();

  const oldKey = 'test-only-existing-vault-key';
  const oldPayload = new TextEncoder().encode('test-only-existing-database');
  const encryptedPayload = await encryptBytes(oldPayload, oldKey);
  const wrappedKey = await encryptBytes(new TextEncoder().encode(oldKey), record.exportKey);
  const recoveredKey = new TextDecoder().decode(await decryptBytes(wrappedKey, client!.exportKey));
  expect(recoveredKey).toBe(oldKey);
  expect(await decryptBytes(encryptedPayload, recoveredKey)).toEqual(oldPayload);
}, 30_000);
