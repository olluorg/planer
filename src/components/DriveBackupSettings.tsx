import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cloud, CloudOff, RefreshCw, Download } from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  driveConfigured, getDriveState, onDriveChange, listDriveBackups, uploadBackup,
  restoreFromDrive, disableDriveBackup, getDrivePassphrase, setDrivePassphrase, type DriveBackup,
} from '@/lib/driveBackup';

const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function DriveBackupSettings() {
  const [state, setState] = useState(getDriveState());
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [items, setItems] = useState<DriveBackup[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => onDriveChange(() => setState(getDriveState())), []);

  if (!driveConfigured()) {
    return (
      <div className="text-sm text-text-muted">
        Резервная копия в Google Диск не настроена в этой сборке.
      </div>
    );
  }

  const connected = state.enabled && Boolean(getDrivePassphrase());

  const enable = async () => {
    if (pass.length < 8) { toast.error('Слишком короткая фраза', 'Минимум 8 символов'); return; }
    if (pass !== pass2) { toast.error('Фразы не совпадают', 'Проверьте оба поля'); return; }
    if (!confirm(
      'Копия шифруется этой фразой на вашем устройстве.\n\n' +
      'Ни Google, ни разработчик не могут её расшифровать. Если вы забудете фразу — ' +
      'копию восстановить будет НЕВОЗМОЖНО.\n\nСохранили фразу в надёжном месте?',
    )) return;

    setBusy(true);
    try {
      setDrivePassphrase(pass);
      await uploadBackup(pass);
      setPass(''); setPass2('');
      toast.success('Копия загружена', 'В скрытую папку приложения на вашем Google Диске');
      void refresh();
    } catch (e) {
      setDrivePassphrase(null); // не оставляем «включено» при неудачном первом заезде
      toast.error('Не удалось подключить', String((e as Error)?.message ?? e));
    } finally { setBusy(false); }
  };

  const backupNow = async () => {
    const p = getDrivePassphrase();
    if (!p) return;
    setBusy(true);
    try {
      await uploadBackup(p);
      toast.success('Копия обновлена');
      void refresh();
    } catch (e) {
      toast.error('Не удалось загрузить', String((e as Error)?.message ?? e));
    } finally { setBusy(false); }
  };

  const refresh = async () => {
    try { setItems(await listDriveBackups()); }
    catch (e) { toast.error('Не удалось получить список', String((e as Error)?.message ?? e)); }
  };

  const restore = async (b: DriveBackup) => {
    const p = getDrivePassphrase();
    if (!p) return;
    if (!confirm(`Восстановить копию от ${fmtDate(b.createdTime)}?\n\nТекущие данные сохранятся локальным снимком.`)) return;
    setBusy(true);
    try {
      await restoreFromDrive(b.id, p);
      location.reload();
    } catch (e) {
      toast.error('Не удалось восстановить', String((e as Error)?.message ?? e));
    } finally { setBusy(false); }
  };

  const disconnect = () => {
    if (!confirm('Отключить копирование? Уже загруженные файлы останутся в вашем Google Диске.')) return;
    disableDriveBackup();
    setItems(null);
    toast.info('Отключено', 'Файлы в Диске не тронуты');
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-text-muted">
        Копия базы шифруется на вашем устройстве и кладётся в скрытую папку приложения
        на вашем Google Диске. Приложение запрашивает единственное разрешение —
        доступ к этой папке; остальные ваши файлы ему не видны. Отозвать доступ можно
        в настройках Google-аккаунта.
      </div>

      {!connected ? (
        <div className="space-y-3">
          <div className="text-sm">
            Придумайте парольную фразу. Ей шифруется копия — <b>восстановить копию без неё нельзя</b>.
          </div>
          <div className="flex gap-2 flex-wrap">
            <Input
              type="password" value={pass} onChange={(e) => setPass(e.target.value)}
              placeholder="Парольная фраза" className="max-w-xs" autoComplete="new-password"
            />
            <Input
              type="password" value={pass2} onChange={(e) => setPass2(e.target.value)}
              placeholder="Ещё раз" className="max-w-xs" autoComplete="new-password"
            />
          </div>
          <Button variant="soft" disabled={busy} onClick={enable}>
            <Cloud /> Подключить Google Диск
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm">
            Подключено.{' '}
            {state.lastBackup
              ? `Последняя копия: ${new Date(state.lastBackup).toLocaleString('ru-RU')}.`
              : 'Копий пока нет.'}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="soft" disabled={busy} onClick={backupNow}><Cloud /> Загрузить копию</Button>
            <Button variant="soft" disabled={busy} onClick={refresh}><RefreshCw /> Показать копии</Button>
            <Button variant="soft" onClick={disconnect}><CloudOff /> Отключить</Button>
          </div>
          {items && (
            items.length === 0 ? (
              <div className="text-sm text-text-muted">В Диске копий нет.</div>
            ) : (
              <ul className="space-y-2">
                {items.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {fmtDate(b.createdTime)}
                      <span className="text-text-muted"> — {fmtSize(b.size)}</span>
                    </span>
                    <Button variant="soft" disabled={busy} onClick={() => restore(b)}>
                      <Download /> Восстановить
                    </Button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
}
