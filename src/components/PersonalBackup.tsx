import { useEffect, useRef, useState } from 'react';
import { Download, Upload, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { exportPersonalData, hasPersonalRecovery, parsePersonalData, restorePersonalData, restorePersonalRecovery } from '@/lib/personalBackup';
import { exportPlugin, getInstalledPlugins } from '@/lib/plugins';
import { persistBeforeReload } from '@/lib/db';

export function PersonalBackup() {
  const [recoverable, setRecoverable] = useState(false);
  const mealPlan = getInstalledPlugins().find(plugin => plugin.id === 'nutrition-month');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void hasPersonalRecovery().then(setRecoverable).catch(() => setRecoverable(false)); }, []);
  const download = () => {
    try {
      const current = exportPersonalData();
      try { parsePersonalData(current); }
      catch { toast.info('Сохранена исходная копия с повреждёнными данными', 'Для обычного импорта данные в файле потребуется исправить.'); }
      const blob = new Blob([JSON.stringify(current)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `thedad-personal-${new Date().toISOString().slice(0,10)}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error('Не удалось подготовить копию', String((error as Error)?.message ?? error)); }
  };
  const importFile = async (file: File) => {
    try {
      if (file.size > 12_000_000) throw new Error('Файл слишком большой');
      const backup = parsePersonalData(JSON.parse(await file.text()));
      if (!confirm('Заменить профиль, данные питания и тренировок, включая фото программ, из этой копии? Существующие значения будут сохранены отдельно в этом браузере. База SQLite не меняется.')) return;
      await persistBeforeReload();
      await restorePersonalData(backup);
      await reloadAfterRestore();
    } catch (error) { toast.error('Не удалось восстановить личные данные', String((error as Error)?.message ?? error)); void hasPersonalRecovery().then(setRecoverable).catch(() => {}); }
  };
  const recover = async () => {
    if (!confirm('Вернуть профиль, питание и тренировки, включая фото программ, к состоянию перед последним импортом? База SQLite не меняется.')) return;
    try { await persistBeforeReload(); await restorePersonalRecovery(); await reloadAfterRestore(); }
    catch (error) { toast.error('Не удалось восстановить предыдущие данные', String((error as Error)?.message ?? error)); }
  };
  const reloadAfterRestore = async () => {
    try { await persistBeforeReload(); location.reload(); }
    catch {
      toast.error('Личные данные восстановлены, но обновить экран не удалось', 'Сохраните изменения базы или скачайте её копию перед перезагрузкой.');
      void hasPersonalRecovery().then(setRecoverable).catch(() => {});
    }
  };
  return <div className="space-y-3">
    <p className="text-sm text-text-muted">Отдельная копия имени и фото профиля, данных питания и тренировок, включая фото, отметки целей и прогресс программ. Файл не зашифрован и может содержать личные сведения. Задачи и цели сохраняются отдельно через экспорт SQLite; настройки, плагины и видеообои в эту копию не входят. Ключи доступа и лицензии не экспортируются: на другом устройстве программу потребуется активировать заново.</p>
    <p className="text-sm text-text-muted">Сохранённый план питания хранится в виджете отдельно от дневника. Экспортируйте его отдельным файлом; для восстановления используйте «Плагины — свои виджеты» → «Импортировать .json».</p>
    <div className="flex flex-wrap gap-2">
      <Button variant="soft" onClick={download}><Download /> Экспорт личных данных</Button>
      {mealPlan && <Button variant="soft" onClick={() => exportPlugin(mealPlan)}><Download /> Экспорт плана питания</Button>}
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e => {const file=e.target.files?.[0]; e.target.value=''; if (file) void importFile(file);}} />
      <Button variant="soft" onClick={() => fileRef.current?.click()}><Upload /> Импорт личных данных</Button>
      {recoverable && <Button variant="soft" onClick={recover}><History /> Вернуть данные до импорта</Button>}
    </div>
  </div>;
}
