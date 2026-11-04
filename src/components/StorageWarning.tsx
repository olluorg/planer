import { useEffect, useState } from 'react';
import { getDB, hasCrossTabConflict, hasPendingPersist, hasPersistFailure, mergeTabConflict, persist, PERSIST_STATUS_EVENT } from '../lib/db';
import { useStore } from '../lib/store';

/** Ошибка записи не должна оставлять пользователя без способа спасти данные в памяти. */
export function StorageWarning() {
  const [failed, setFailed] = useState(hasPersistFailure);
  const [pending, setPending] = useState(hasPendingPersist);
  const [retrying, setRetrying] = useState(false);
  const [conflict, setConflict] = useState(hasCrossTabConflict);
  const [mergeError, setMergeError] = useState('');
  useEffect(() => {
    const update = () => { setFailed(hasPersistFailure()); setConflict(hasCrossTabConflict()); setPending(hasPendingPersist()); };
    window.addEventListener(PERSIST_STATUS_EVENT, update);
    update();
    return () => window.removeEventListener(PERSIST_STATUS_EVENT, update);
  }, []);
  if (!failed) return pending ? <div role="status" className="border-b border-border-soft px-4 py-1 text-xs text-text-muted">Сохраняем изменения…</div> : null;

  async function retry() {
    setRetrying(true);
    try { await persist(); } catch { /* предупреждение остаётся */ }
    finally { setRetrying(false); }
  }
  async function download() {
    const data = (await getDB()).export();
    const url = URL.createObjectURL(new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `thedad-unsaved-${new Date().toISOString().slice(0, 10)}.sqlite`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async function merge() {
    if (!window.confirm('Объединить данные вкладок? Для одной записи сохраняется более позднее изменение. Если в другой вкладке базу сбросили или восстановили, старые записи могут вернуться. Перед объединением будет создан локальный снимок.')) return;
    setRetrying(true);
    setMergeError('');
    try { await mergeTabConflict(); useStore.getState().reload(); }
    catch (error) { setMergeError(String((error as Error)?.message ?? error)); }
    finally { setRetrying(false); }
  }
  return (
    <div role="alert" className="border-b border-amber-700 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50">
      <p className="font-semibold">{conflict ? 'Данные изменились в другой вкладке' : 'Не удалось сохранить изменения на устройстве'}</p>
      <p>{conflict ? 'Изменения этой вкладки остались в памяти. Их можно объединить с данными другой вкладки или скачать отдельной копией.' : 'Данные пока находятся в памяти. Проверьте свободное место или доступ к хранилищу и сохраните копию перед закрытием приложения.'}</p>
      {mergeError && <p>{mergeError}</p>}
      <div className="mt-2 flex flex-wrap gap-3">
        {conflict && <button type="button" className="underline underline-offset-2" disabled={retrying} onClick={() => void merge()}>{retrying ? 'Объединяем…' : 'Объединить изменения'}</button>}
        {!conflict && <button type="button" className="underline underline-offset-2" disabled={retrying} onClick={() => void retry()}>{retrying ? 'Сохраняем…' : 'Повторить сохранение'}</button>}
        <button type="button" className="underline underline-offset-2" onClick={() => void download()}>Скачать текущую базу</button>
      </div>
    </div>
  );
}
