import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { resetDB, persist } from '@/lib/db';
import { useStore } from '@/lib/store';
import { Download, Upload, RefreshCw } from 'lucide-react';
import { get, set } from 'idb-keyval';

export const SettingsPage = () => {
  const reload = useStore((s) => s.reload);

  const exportDb = async () => {
    await persist();
    const blob = await get<Uint8Array>('reform.sqlite.v1');
    if (!blob) return;
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `reform-${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDb = async (file: File) => {
    const buf = new Uint8Array(await file.arrayBuffer());
    await set('reform.sqlite.v1', buf);
    location.reload();
  };

  const reset = async () => {
    if (!confirm('Удалить все данные и пересоздать БД?')) return;
    await resetDB();
    reload();
    location.reload();
  };

  return (
    <div className="p-4 max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Настройки</h1>

      <Card>
        <CardTitle>База данных (SQLite WASM)</CardTitle>
        <div className="text-sm text-text-muted mb-4">
          Все данные хранятся локально в IndexedDB через WebAssembly-сборку SQLite. Можно выгрузить в файл или импортировать обратно.
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="soft" onClick={exportDb}><Download /> Экспорт .sqlite</Button>
          <label>
            <input
              type="file"
              accept=".sqlite,.db,application/octet-stream"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importDb(e.target.files[0])}
            />
            <Button variant="soft" asChild><span><Upload /> Импорт .sqlite</span></Button>
          </label>
          <Button variant="danger" onClick={reset}><RefreshCw /> Сбросить</Button>
        </div>
      </Card>

      <Card>
        <CardTitle>О приложении</CardTitle>
        <ul className="text-sm space-y-1 text-text-muted">
          <li>React + Vite, shadcn/ui, Apache ECharts, dnd-kit</li>
          <li>SQLite (sql.js + WASM), персист в IndexedDB</li>
          <li>Прогноз: линейная регрессия + 95% доверительный интервал</li>
          <li>Работает офлайн</li>
        </ul>
      </Card>
    </div>
  );
};
