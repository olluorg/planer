// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Поток входа в расширении: chrome.identity вместо скрипта Google Identity. */
describe('копия в Google Диск — вход из расширения', () => {
  let authUrl = '';
  let answer = '';

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123.apps.googleusercontent.com');
    vi.stubGlobal('chrome', {
      runtime: { id: 'abcdefghijklmnop' }, // делает isExtension истинным
      identity: {
        getRedirectURL: () => 'https://abcdefghijklmnop.chromiumapp.org/',
        launchWebAuthFlow: vi.fn(async ({ url }: { url: string }) => { authUrl = url; return answer; }),
      },
    });
  });

  it('запрашивает только папку приложения и отдаёт токен в запросы к Диску', async () => {
    answer = 'https://abcdefghijklmnop.chromiumapp.org/#access_token=tok-xyz&expires_in=3599&token_type=Bearer';
    const seen: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      seen.push(String((init.headers as Record<string, string>).Authorization));
      return new Response(JSON.stringify({ files: [] }), { status: 200 });
    }));
    const drive = await import('../driveBackup');
    await drive.listDriveBackups(true);

    const u = new URL(authUrl);
    expect(u.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.appdata');
    expect(u.searchParams.get('response_type')).toBe('token');
    expect(u.searchParams.get('redirect_uri')).toBe('https://abcdefghijklmnop.chromiumapp.org/');
    expect(u.searchParams.get('client_id')).toBe('client-123.apps.googleusercontent.com');
    expect(seen).toEqual(['Bearer tok-xyz']);
  });

  it('отказ пользователя превращается в понятную ошибку', async () => {
    answer = 'https://abcdefghijklmnop.chromiumapp.org/#error=access_denied';
    const drive = await import('../driveBackup');
    await expect(drive.listDriveBackups(true)).rejects.toThrow(/access_denied/);
  });

  it('автобэкап не открывает окно входа', async () => {
    answer = 'https://abcdefghijklmnop.chromiumapp.org/#access_token=t&expires_in=3599';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ files: [] }), { status: 200 })));
    const drive = await import('../driveBackup');
    await drive.listDriveBackups(false);
    const call = (globalThis as unknown as { chrome: { identity: { launchWebAuthFlow: { mock: { calls: [{ interactive: boolean }][] } } } } })
      .chrome.identity.launchWebAuthFlow.mock.calls[0][0];
    expect(call.interactive).toBe(false);
    expect(new URL(authUrl).searchParams.get('prompt')).toBeNull();
  });
});
