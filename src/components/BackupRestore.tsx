import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { listBackups, restoreBackup, saveBackup, persist, DB_KEY, BACKUPS_EVENT, type BackupEntry } from '@/lib/db';
import { toast } from '@/lib/toast';
import { get } from 'idb-keyval';
import { History } from 'lucide-react';

const REASON_LABEL: Record<string, string> = {
  daily: 'Автоматически, раз в сутки',
  'pre-import': 'Перед импортом файла',
  'pre-restore': 'Перед восстановлением',
  manual: 'Вручную',
};

const fmt = (ts: number) =>
  new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Локальные автоснимки БД. Страхуют от случая, когда файловый экспорт
 *  никто не делал, а данные уже испорчены или потеряны. */
export function BackupRestore() {
  const [items, setItems] = useState<BackupEntry[]>([]);
  const refresh = () => listBackups().then(setItems);

  useEffect(() => {
    void refresh();
    const on = () => void refresh();
    window.addEventListener(BACKUPS_EVENT, on);
    return () => window.removeEventListener(BACKUPS_EVENT, on);
  }, []);

  const makeNow = async () => {
    await persist();
    const data = await get<Uint8Array>(DB_KEY);
    if (!data) return;
    await saveBackup(data, 'manual');
    await refresh();
    toast.success('Снимок создан', 'Хранится локально, в браузере');
  };

  const restore = async (b: BackupEntry) => {
    if (!confirm(`Восстановить состояние от ${fmt(b.at)}?\n\nТекущие данные будут сохранены отдельным снимком.`)) return;
    try {
      await restoreBackup(b.key);
      location.reload();
    } catch (e) {
      toast.error('Не удалось восстановить', String((e as Error)?.message ?? e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm text-text-muted">
        Приложение само хранит несколько последних снимков базы — раз в сутки и перед
        рискованными операциями. Они лежат в этом браузере: для защиты от потери
        устройства делайте файловый экспорт.
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="soft" onClick={makeNow}><History /> Сделать снимок сейчас</Button>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-text-muted">Снимков пока нет.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((b) => (
            <li key={b.key} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {fmt(b.at)}
                <span className="text-text-muted"> — {REASON_LABEL[b.reason] ?? b.reason}</span>
              </span>
              <Button variant="soft" onClick={() => restore(b)}>Восстановить</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
