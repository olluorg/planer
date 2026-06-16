import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInbox, type InboxKind } from '@/lib/inbox';
import { Check, Trash2, Inbox as InboxIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const KIND_ICON: Record<InboxKind, string> = {
  achievement: '🏆',
  level_up: '⭐',
  streak_milestone: '🔥',
  combo: '⚡',
  weekly_win: '🥇',
  daily_quest_full: '🎰',
  heartbeat: '💗',
  reminder: '🔔',
  system: 'ℹ️',
};

interface Props {
  open: boolean;
  onClose: () => void;
  anchor?: { top: number; right: number };
}

export const InboxPopover: React.FC<Props> = ({ open, onClose, anchor }) => {
  const nav = useNavigate();
  const items = useInbox((s) => s.items);
  const markRead = useInbox((s) => s.markRead);
  const markAllRead = useInbox((s) => s.markAllRead);
  const remove = useInbox((s) => s.remove);
  const clear = useInbox((s) => s.clear);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[180]" />
      <div
        ref={ref}
        className="fixed z-[190] w-96 max-w-[92vw] rounded-2xl bg-bg-card border border-border-soft shadow-card overflow-hidden animate-slide-up"
        style={{
          top: anchor ? `${anchor.top}px` : '80px',
          right: anchor ? `${anchor.right}px` : '24px',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
          <div className="flex items-center gap-2">
            <InboxIcon className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-text">Уведомления</h3>
            {items.filter((x) => !x.read).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-white">
                {items.filter((x) => !x.read).length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {items.some((x) => !x.read) && (
              <button
                onClick={markAllRead}
                title="Прочитать все"
                className="text-[11px] text-text-muted hover:text-text px-2 py-1 rounded-md hover:bg-bg-soft"
              >
                Прочитать все
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={clear}
                title="Очистить"
                className="text-[11px] text-text-muted hover:text-danger px-2 py-1 rounded-md hover:bg-bg-soft"
              >
                Очистить
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-2">📭</div>
              <div className="text-sm text-text font-medium">Пусто</div>
              <div className="text-xs text-text-muted mt-1">Сюда придут награды, серии и важные события.</div>
            </div>
          ) : (
            <ul className="divide-y divide-border-soft">
              {items.map((it) => (
                <li
                  key={it.id}
                  className={`group px-4 py-3 hover:bg-bg-soft transition-colors flex items-start gap-3 ${it.read ? '' : 'bg-accent/5'}`}
                >
                  <div className="text-xl shrink-0 leading-none mt-0.5">{it.icon ?? KIND_ICON[it.kind]}</div>
                  <button
                    type="button"
                    onClick={() => {
                      markRead(it.id);
                      if (it.link) { nav(it.link); onClose(); }
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      {!it.read && <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />}
                      <div className="text-sm font-semibold text-text truncate">{it.title}</div>
                    </div>
                    {it.body && <div className="text-[12px] text-text-muted leading-snug mt-0.5">{it.body}</div>}
                    <div className="text-[10px] text-text-dim mt-1">
                      {formatDistanceToNow(it.ts, { addSuffix: true, locale: ru })}
                    </div>
                  </button>
                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!it.read && (
                      <button
                        onClick={() => markRead(it.id)}
                        title="Прочитать"
                        className="h-6 w-6 rounded-md hover:bg-bg-hover text-text-muted flex items-center justify-center"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => remove(it.id)}
                      title="Удалить"
                      className="h-6 w-6 rounded-md hover:bg-bg-hover text-text-muted hover:text-danger flex items-center justify-center"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};
