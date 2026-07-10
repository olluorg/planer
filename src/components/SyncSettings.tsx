import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import {
  getSync, disconnectSync, registerEmail, loginEmail, createVault,
  buildSyncLink, pushNow, pullNow, type SyncConfig,
} from '@/lib/sync';
import { RefreshCw, QrCode, LogOut, UploadCloud, DownloadCloud, Cloud } from 'lucide-react';

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
  const refresh = () => setCfg(getSync());

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); refresh(); toast.success(ok); }
    catch (e: any) { toast.error('Ошибка синхронизации', String(e?.message ?? e)); }
    finally { setBusy(false); }
  };

  const showQr = async () => {
    const link = buildSyncLink();
    if (!link) return;
    const QRCode = (await import('qrcode')).default;
    setQr(await QRCode.toDataURL(link, { width: 220, margin: 1 }));
  };

  useEffect(() => { if (cfg) void showQr(); else setQr(null); /* eslint-disable-next-line */ }, [cfg?.syncId]);

  if (cfg) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-text">Подключено{cfg.email ? ` · ${cfg.email}` : ' · по ключу устройства'}</span>
          <span className="text-text-muted text-xs ml-auto">{cfg.serverUrl}</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" disabled={busy} onClick={() => run(async () => { await pushNow(); }, 'Данные отправлены на сервер')}><UploadCloud className="h-4 w-4" /> Отправить</Button>
          <Button variant="soft" size="sm" disabled={busy} onClick={() => run(async () => { if (await pullNow()) { toast.success('Данные загружены'); setTimeout(() => location.reload(), 600); } else toast.info('На сервере пока пусто'); }, 'Готово')}><DownloadCloud className="h-4 w-4" /> Загрузить</Button>
          <Button variant="ghost" size="sm" disabled={busy} className="text-danger" onClick={() => { disconnectSync(); refresh(); }}><LogOut className="h-4 w-4" /> Отключить</Button>
        </div>

        <div className="rounded-xl border border-border bg-bg-soft p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-2"><QrCode className="h-4 w-4 text-accent" /> Привязать другое устройство</div>
          <div className="text-xs text-text-muted mb-3">Отсканируй этот QR камерой телефона — приложение откроется и подтянет твои данные. Код содержит ключ доступа, не показывай чужим.</div>
          {qr && <img src={qr} alt="Sync QR" className="rounded-lg bg-white p-2 w-[200px]" />}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-text-muted">
        Синхронизируй данные между устройствами. Всё шифруется на твоём устройстве — сервер видит только зашифрованный блоб.
      </div>
      <div>
        <div className="text-[11px] text-text-muted mb-1">Адрес сервера</div>
        <Input value={server} onChange={(e) => setServer(e.target.value)} placeholder={DEFAULT_SERVER} />
      </div>

      <div className="rounded-xl border border-border p-4 space-y-2">
        <div className="text-sm font-medium">Вход по email</div>
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
