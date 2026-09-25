import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Upload } from 'lucide-react';
import { readFileText } from '@/lib/importCsv';
import { parseImportFile, applyImport, SOURCE_LABEL, type ImportResult } from '@/lib/importers';
import { useStore } from '@/lib/store';
import { toast } from '@/lib/toast';
import { todayISO } from '@/lib/utils';
import { persist, saveBackup, DB_KEY } from '@/lib/db';
import { get } from 'idb-keyval';

/** Переезд из Todoist, TickTick и Google Tasks: файл → превью → импорт.
 *  Превью обязательно — человек должен увидеть, что приложение поняло его
 *  файл, до того как в задачах появятся сотни новых строк. */
export function ImportFromServices() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [includeDone, setIncludeDone] = useState(false);

  const pick = async (file: File) => {
    try {
      setResult(parseImportFile(await readFileText(file)));
      setIncludeDone(false);
    } catch (e) {
      toast.error('Не удалось прочитать файл', String((e as Error)?.message ?? e));
    }
  };

  const run = async () => {
    if (!result) return;
    // Снимок до импорта: сотни чужих задач не должны быть необратимы.
    await persist();
    const before = await get<Uint8Array>(DB_KEY);
    if (before) await saveBackup(before, 'pre-import');
    const s = useStore.getState();
    let n = 0;
    s.batch(() => {
      n = applyImport(result.tasks, { includeCompleted: includeDone, today: todayISO() }, (t) => s.addTask(t));
    });
    toast.success(`Импортировано задач: ${n}`, `Из ${SOURCE_LABEL[result.source]}`);
    setResult(null);
  };

  const active = result?.tasks.filter((t) => !t.done).length ?? 0;
  const done = (result?.tasks.length ?? 0) - active;
  const count = includeDone ? (result?.tasks.length ?? 0) : active;

  return (
    <>
      <div className="text-sm text-text-muted mb-3">
        Переезд из другого планера: файл экспорта Todoist (CSV), резервная копия
        TickTick (CSV) или Tasks.json из Google Takeout. Формат определяется сам.
      </div>
      <label>
        <input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f); }}
        />
        <Button variant="soft" asChild>
          <span><Upload /> Из Todoist, TickTick, Google Tasks</span>
        </Button>
      </label>

      <Dialog open={!!result} onOpenChange={(v) => !v && setResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Импорт из {result ? SOURCE_LABEL[result.source] : ''}</DialogTitle>
            <DialogDescription>
              Найдено задач: {active} активных{done ? `, ${done} выполненных` : ''}.
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-3">
              <ul className="text-sm space-y-1 max-h-48 overflow-y-auto rounded-lg bg-bg-soft p-3">
                {result.tasks.slice(0, 12).map((t) => (
                  <li key={t.key} className={`truncate ${t.parentKey ? 'pl-4 text-text-muted' : ''} ${t.done ? 'line-through text-text-dim' : ''}`}>
                    {t.title}
                    {t.list && <span className="text-caption text-text-dim"> · {t.list}</span>}
                  </li>
                ))}
                {result.tasks.length > 12 && <li className="text-caption text-text-dim">…и ещё {result.tasks.length - 12}</li>}
              </ul>
              {done > 0 && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />
                  Перенести и выполненные — для истории
                </label>
              )}
              {result.warnings.map((w) => <p key={w} className="text-caption text-warning">{w}</p>)}
              <p className="text-caption text-text-dim">
                Проекты и списки станут тегами. Перед импортом приложение сохранит снимок
                базы — если результат не понравится, откатить можно в «Резервных копиях».
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResult(null)}>Отмена</Button>
            <Button disabled={count === 0} onClick={() => void run()}>Импортировать {count}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
