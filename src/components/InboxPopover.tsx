import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInbox, type InboxKind } from '@/lib/inbox';
import { useStore } from '@/lib/store';
import { computeInsights, type InsightTone } from '@/lib/insights';
import { Check, Trash2, Inbox as InboxIcon, Lightbulb } from 'lucide-react';
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

const TONE_STYLE: Record<InsightTone, { bg: string; bar: string }> = {
  positive: { bg: 'rgba(34,197,94,0.08)', bar: '#22c55e' },
  warning:  { bg: 'rgba(239,68,68,0.08)', bar: '#ef4444' },
  neutral:  { bg: 'rgba(100,116,139,0.08)', bar: '#94a3b8' },
  info:     { bg: 'rgba(99,102,241,0.08)', bar: '#6366f1' },
};

interface Props {
  open: boolean;
  onClose: () => void;
  anchor?: { top: number; right: number };
  /** Стартовая вкладка: колокол → уведомления, лампочка/Ctrl+I → инсайты. */
  initialTab?: 'inbox' | 'insights';
}

/** Единая панель: две вкладки — Уведомления и Инсайты. */
export const InboxPopover: React.FC<Props> = ({ open, onClose, anchor, initialTab = 'inbox' }) => {
  const nav = useNavigate();
  const items = useInbox((s) => s.items);
  const markRead = useInbox((s) => s.markRead);
  const markAllRead = useInbox((s) => s.markAllRead);
  const remove = useInbox((s) => s.remove);
  const clear = useInbox((s) => s.clear);
  const { tasks, habits, habitLogs, reflections, timeEntries, goals, progress } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'inbox' | 'insights'>(initialTab);

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  const insights = useMemo(
    () => computeInsights({ today: new Date(), tasks, habits, habitLogs, reflections, timeEntries, goals, progress }),
    [tasks, habits, habitLogs, reflections, timeEntries, goals, progress],
  );

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const unread = items.filter((x) => !x.read).length;

  const Tab: React.FC<{ id: 'inbox' | 'insights'; icon: React.ElementType; label: string; badge?: number }> = ({ id, icon: Icon, label, badge }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 flex items-center justify-center gap-1.5 h-9 text-[13px] font-medium rounded-lg transition-colors ${
        tab === id ? 'bg-bg-soft text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {badge ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-white leading-none">{badge}</span> : null}
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-[180]" />
      <div
        ref={ref}
        className="fixed z-[190] w-96 max-w-[92vw] rounded-2xl bg-bg-card border border-border-soft shadow-card overflow-hidden animate-slide-up"
        style={{ top: anchor ? `${anchor.top}px` : '80px', right: anchor ? `${anchor.right}px` : '24px' }}
      >
        {/* Вкладки */}
        <div className="flex items-center gap-1 p-1.5 border-b border-border-soft">
          <Tab id="inbox" icon={InboxIcon} label="Уведомления" badge={unread} />
          <Tab id="insights" icon={Lightbulb} label="Инсайты" badge={insights.length || undefined} />
        </div>

        {tab === 'inbox' ? (
          <>
            {(items.some((x) => !x.read) || items.length > 0) && (
              <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-b border-border-soft">
                {items.some((x) => !x.read) && (
                  <button onClick={markAllRead} className="text-[11px] text-text-muted hover:text-text px-2 py-1 rounded-md hover:bg-bg-soft">Прочитать все</button>
                )}
                {items.length > 0 && (
                  <button onClick={clear} className="text-[11px] text-text-muted hover:text-danger px-2 py-1 rounded-md hover:bg-bg-soft">Очистить</button>
                )}
              </div>
            )}
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
                    <li key={it.id} className={`group px-4 py-3 hover:bg-bg-soft transition-colors flex items-start gap-3 ${it.read ? '' : 'bg-accent/5'}`}>
                      <div className="text-xl shrink-0 leading-none mt-0.5">{it.icon ?? KIND_ICON[it.kind]}</div>
                      <button
                        type="button"
                        onClick={() => { markRead(it.id); if (it.link) { nav(it.link); onClose(); } }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2">
                          {!it.read && <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />}
                          <div className="text-sm font-semibold text-text truncate">{it.title}</div>
                        </div>
                        {it.body && <div className="text-[12px] text-text-muted leading-snug mt-0.5">{it.body}</div>}
                        <div className="text-[10px] text-text-dim mt-1">{formatDistanceToNow(it.ts, { addSuffix: true, locale: ru })}</div>
                      </button>
                      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!it.read && (
                          <button onClick={() => markRead(it.id)} title="Прочитать" className="h-6 w-6 rounded-md hover:bg-bg-hover text-text-muted flex items-center justify-center">
                            <Check className="h-3 w-3" />
                          </button>
                        )}
                        <button onClick={() => remove(it.id)} title="Удалить" className="h-6 w-6 rounded-md hover:bg-bg-hover text-text-muted hover:text-danger flex items-center justify-center">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2.5">
            {insights.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-3xl mb-2">🧭</div>
                <div className="text-sm text-text font-medium">Пока нет инсайтов</div>
                <div className="text-xs text-text-muted mt-1">Поработай несколько дней — появятся наблюдения о твоём ритме.</div>
              </div>
            ) : (
              insights.map((ins) => {
                const s = TONE_STYLE[ins.tone];
                return (
                  <button
                    key={ins.id}
                    onClick={() => { if (ins.link) { nav(ins.link); onClose(); } }}
                    className="w-full text-left rounded-xl p-3 transition-all hover:shadow-soft"
                    style={{ background: s.bg, borderLeft: `3px solid ${s.bar}` }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg leading-none mt-0.5">{ins.icon}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-text leading-snug">{ins.title}</div>
                        <div className="text-xs text-text-muted leading-relaxed mt-1">{ins.body}</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            <div className="pt-1 text-[11px] text-text-muted text-center">Наблюдения на основе твоих данных. Без серверов и AI.</div>
          </div>
        )}
      </div>
    </>
  );
};
