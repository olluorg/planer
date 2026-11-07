import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { persistBeforeReload } from '@/lib/db';
import {
  getSync, onSyncChange, disconnectSync, registerEmail, loginEmail, createVault, changeSyncServerUrl,
  buildSyncLink, syncLinkWarning, pullNow, syncNowFresh, type SyncConfig,
} from '@/lib/sync';
import { RefreshCw, QrCode, LogOut, DownloadCloud, Cloud } from 'lucide-react';

// Прод-адрес задаётся при сборке: VITE_SYNC_SERVER_URL (см. .env.example).
// Без него — локальный сервер для разработки.
const DEFAULT_SERVER = import.meta.env.VITE_SYNC_SERVER_URL || 'http://localhost:8787';

export const SyncSettings: React.FC = () => {
  const [cfg, setCfg] = useState<SyncConfig | null>(getSync());
  const [server, setServer] = useState(cfg?.serverUrl || DEFAULT_SERVER);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [editingServer, setEditingServer] = useState(false);
  const refresh = () => setCfg(getSync());
  useEffect(() => onSyncChange(() => setCfg(getSync())), []);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); refresh(); if (ok) toast.success(ok); }
    catch (e: any) { refresh(); toast.error('Ошибка синхронизации', String(e?.message ?? e)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    const link = cfg ? buildSyncLink() : null;
    if (link) void import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(link, { width: 220, margin: 1 }))
      .then(value => { if (!cancelled) setQr(value); }).catch(() => { if (!cancelled) setQr(null); });
    return () => { cancelled = true; };
    // Timestamp-only updates do not change the QR payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.syncId, cfg?.serverUrl, cfg?.authToken, cfg?.encKey]);
  const qrWarning = cfg ? syncLinkWarning(cfg.serverUrl, window.location.href) : null;

  if (cfg) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${cfg.lastSync ? 'bg-success' : 'bg-warning'}`} />
          <span className="text-text">{cfg.lastSync ? 'Подключено' : 'Ожидает синхронизации'}{cfg.email ? ` · ${cfg.email}` : ' · по ключу устройства'}</span>
          <span className="text-text-muted text-xs ml-auto">{cfg.serverUrl}</span>
        </div>

        {!cfg.lastSync && <div className="text-xs text-warning" role="status">Подключение создано, но первая синхронизация не завершена. Повторите синхронизацию.</div>}
        {cfg.email && <p className="text-xs text-text-muted">При входе по email пароль передаётся серверу, который технически может вычислить ключ расшифровки. Используйте HTTPS и сервер, которому доверяете.</p>}
        <div className="rounded-xl border border-border p-3 space-y-2">
          {!editingServer ? <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setServer(cfg.serverUrl); setEditingServer(true); }}>Изменить адрес сервера</Button> : <>
            <label className="block text-xs text-text-muted">Новый адрес сервера<Input className="mt-1" value={server} onChange={e => setServer(e.target.value)} /></label>
            <p className="text-xs text-text-muted">Укажите HTTPS-адрес доверенного сервера с тем же хранилищем. Проверим доступ и, если в хранилище есть данные, ключ. Данные при смене адреса не переносятся.</p>
            <div className="flex gap-2"><Button size="sm" disabled={busy || !server.trim()} onClick={() => run(async () => { await changeSyncServerUrl(server); setEditingServer(false); }, 'Адрес сервера обновлён')}>Проверить и сохранить</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditingServer(false)}>Отмена</Button></div>
          </>}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" disabled={busy} onClick={() => run(async () => {
            const r = await syncNowFresh();
            toast.success('Синхронизировано', r.incoming || r.deleted
              ? `С других устройств: ${r.incoming} изменений${r.deleted ? `, удалено ${r.deleted}` : ''}`
              : 'Всё и так совпадало');
          }, '')}><RefreshCw className="h-4 w-4" /> Синхронизировать</Button>
          <Button variant="soft" size="sm" disabled={busy} title="Заменить данные на этом устройстве копией с сервера — на случай, если что-то пошло не так. Текущие данные сохранятся снимком." onClick={() => run(async () => {
            if (!confirm('Заменить данные на этом устройстве копией с сервера?\n\nТекущие данные сохранятся локальным снимком.')) return;
            if (await pullNow()) {
              await persistBeforeReload();
              location.reload();
            } else toast.info('На сервере пока пусто');
          }, '')}><DownloadCloud className="h-4 w-4" /> Заменить копией с сервера</Button>
          <Button variant="ghost" size="sm" disabled={busy} className="text-danger" onClick={() => { disconnectSync(); refresh(); }}><LogOut className="h-4 w-4" /> Отключить</Button>
        </div>

        <div className="rounded-xl border border-border bg-bg-soft p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-2"><QrCode className="h-4 w-4 text-accent" /> Привязать другое устройство</div>
          <div className="text-xs text-text-muted mb-3">Отсканируй этот QR камерой телефона — приложение откроется и подтянет твои данные. Код содержит ключ доступа, не показывай чужим.</div>
          {qrWarning && <div className="text-xs text-warning mb-3" role="status">{qrWarning}</div>}
          {qr && <img src={qr} alt="Sync QR" className="rounded-lg bg-white p-2 w-[200px]" />}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-text-muted">
        Данные шифруются на устройстве перед отправкой на сервер.
      </div>
      <div>
        <div className="text-[11px] text-text-muted mb-1">Адрес сервера</div>
        <Input value={server} onChange={(e) => setServer(e.target.value)} placeholder={DEFAULT_SERVER} />
        <p className="mt-1 text-xs text-text-muted">Удалённый сервер должен использовать HTTPS; HTTP доступен только для localhost.</p>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-2">
        <div className="text-sm font-medium">Вход по email</div>
        <p className="text-xs text-text-muted">При входе пароль передаётся серверу, который технически может вычислить ключ расшифровки. Используйте HTTPS и сервер, которому доверяете.</p>
        <Input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" placeholder="пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex gap-2">
          <Button size="sm" disabled={busy || !email || !password} onClick={() => run(() => loginEmail(server, email, password), 'Вход выполнен, данные загружены')}>Войти</Button>
          <Button variant="soft" size="sm" disabled={busy || !email || !password} onClick={() => run(() => registerEmail(server, email, password), 'Аккаунт создан, синхронизация включена')}>Регистрация</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="text-sm font-medium mb-1 flex items-center gap-2"><Cloud className="h-4 w-4 text-accent" /> Без аккаунта (по QR)</div>
        <div className="text-xs text-text-muted mb-3">Создаёт приватное хранилище без email. Привяжешь другие устройства сканом QR-кода.</div>
        <Button variant="soft" size="sm" disabled={busy} onClick={() => run(() => createVault(server), 'Хранилище создано')}><RefreshCw className="h-4 w-4" /> Создать хранилище</Button>
      </div>
    </div>
  );
};
