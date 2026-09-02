import { Component, type ErrorInfo, type ReactNode } from 'react';
import { recordCrash, buildCrashReport } from '@/lib/crashlog';
import { DB_KEY } from '@/lib/db';
import { get } from 'idb-keyval';

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Ловит ошибки рендера. Без неё любое исключение в дереве даёт белый экран,
 *  из которого пользователь не может даже забрать свои данные. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordCrash('render', error, info.componentStack ?? undefined);
  }

  private downloadBackup = async () => {
    const blob = await get<Uint8Array>(DB_KEY);
    if (!blob) return;
    const url = URL.createObjectURL(new Blob([blob.buffer as ArrayBuffer], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `thedad-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  };

  private copyReport = async () => {
    try { await navigator.clipboard.writeText(buildCrashReport()); } catch {}
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full flex items-center justify-center bg-bg p-6">
        <div className="max-w-lg w-full space-y-4">
          <div className="text-2xl font-semibold">Что-то сломалось</div>
          <div className="text-sm text-text-muted">
            Ваши данные на месте — они хранятся отдельно от интерфейса. Скачайте резервную копию
            и пришлите отчёт, если ошибка повторяется.
          </div>
          <pre className="text-xs bg-surface rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2 flex-wrap">
            <button className="px-4 py-2 rounded-xl bg-accent text-white" onClick={() => window.location.reload()}>
              Перезагрузить
            </button>
            <button className="px-4 py-2 rounded-xl border border-border-soft" onClick={this.downloadBackup}>
              Скачать бэкап
            </button>
            <button className="px-4 py-2 rounded-xl border border-border-soft" onClick={this.copyReport}>
              Скопировать отчёт
            </button>
          </div>
        </div>
      </div>
    );
  }
}
