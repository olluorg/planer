import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ShoppingBag, KeyRound, Check, ExternalLink, Loader2, ShieldCheck, Sparkles, PlayCircle } from 'lucide-react';
import {
  fetchCatalog, ownedPackIds, redeemLicense, fetchProgram, applyProgram,
  installedProgramIds, openProgram, openWorkoutHub, PROGRAMS_EVENT,
  LICENSES_EVENT, type CatalogItem,
} from '@/lib/marketplace';
import { useStore } from '@/lib/store';
import { toast } from '@/lib/toast';

/** Витрина премиум-«Программ». Открывается событием thedad:marketplace из WidgetPicker/Шаблонов.
 *  Покупка — на внешней странице (buyUrl) → лиценз-ключ → «Ввести ключ» → установка. */
export const MarketplaceModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { addGoal, addHabit, addTask } = useStore();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const refreshOwned = useCallback(() => {
    setOwned(new Set(ownedPackIds()));
    setInstalled(new Set(installedProgramIds()));
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchCatalog().then((c) => setItems(c.items)).finally(() => setLoading(false));
    refreshOwned();
    const onLic = () => refreshOwned();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener(LICENSES_EVENT, onLic);
    window.addEventListener(PROGRAMS_EVENT, onLic);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener(LICENSES_EVENT, onLic);
      window.removeEventListener(PROGRAMS_EVENT, onLic);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, refreshOwned]);

  const redeem = async () => {
    const raw = keyValue.trim();
    if (!raw) return;
    setRedeeming(true);
    try {
      const unlocked = await redeemLicense(raw);
      refreshOwned();
      setKeyValue('');
      setKeyOpen(false);
      toast.success('Ключ активирован', `Открыто программ: ${unlocked.length}`);
    } catch (err) {
      toast.error('Ключ не принят', err instanceof Error ? err.message : undefined);
    } finally {
      setRedeeming(false);
    }
  };

  const install = async (item: CatalogItem) => {
    setInstalling(item.id);
    try {
      const pack = await fetchProgram(item.id);
      const n = applyProgram(pack, { addGoal, addHabit, addTask });
      setDone((s) => new Set([...s, item.id]));
      setInstalled((s) => new Set([...s, item.id]));
      toast.success(`Программа «${pack.title}» установлена`, `Добавлено элементов: ${n} · открой плеер, чтобы пройти по дням`);
    } catch (err) {
      toast.error('Не удалось установить', err instanceof Error ? err.message : undefined);
    } finally {
      setInstalling(null);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-surface relative z-10 w-full max-w-3xl max-h-[90vh] rounded-2xl bg-bg-card border border-border shadow-2xl overflow-hidden flex flex-col animate-[slide-up_200ms_ease-out]">
        {/* Шапка */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border-soft shrink-0">
          <ShoppingBag className="h-5 w-5 text-accent shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-text truncate">Премиум-программы</div>
            <div className="text-[11px] text-text-muted truncate">Готовые многонедельные курсы — разворачиваются во все виджеты</div>
          </div>
          <button
            onClick={() => setKeyOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-bg-soft hover:bg-bg-hover border border-border-soft px-2.5 py-1.5 text-xs text-text-muted hover:text-text shrink-0"
            title="Ввести лиценз-ключ"
          >
            <KeyRound className="h-3.5 w-3.5" /> Есть ключ
          </button>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text shrink-0" title="Закрыть (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Ввод ключа */}
        {keyOpen && (
          <div className="px-5 py-3 border-b border-border-soft bg-bg-soft/40 shrink-0 flex gap-2">
            <input
              autoFocus
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') redeem(); }}
              placeholder="THEDAD-..."
              className="flex-1 rounded-lg bg-bg-card border border-border px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
            <button
              onClick={redeem}
              disabled={redeeming || !keyValue.trim()}
              className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Активировать
            </button>
          </div>
        )}

        {/* Сетка программ */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-16 flex justify-center text-text-dim"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-text-dim">Витрина пока пуста</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((it) => {
                const isOwned = owned.has(it.id);
                const isDone = done.has(it.id);
                const busy = installing === it.id;
                return (
                  <div key={it.id} className="flex flex-col rounded-xl border border-border-soft bg-bg-soft/50 overflow-hidden">
                    {it.preview && (
                      <img
                        src={it.preview}
                        alt=""
                        className="h-32 w-full object-cover"
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="flex flex-col flex-1 p-3.5">
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 rounded-xl bg-bg-card border border-border-soft text-2xl flex items-center justify-center shrink-0">{it.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-semibold text-text leading-snug flex-1 min-w-0">{it.title}</h3>
                            {isOwned ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 text-green-500 px-2 py-0.5 text-[10px] font-medium shrink-0"><Check className="h-3 w-3" /> Куплено</span>
                            ) : (
                              <span className="rounded-full bg-accent/12 text-accent px-2 py-0.5 text-[11px] font-semibold shrink-0">{it.price}</span>
                            )}
                          </div>
                          <div className="text-[12px] text-text-muted mt-0.5 leading-snug">{it.tagline}</div>
                        </div>
                      </div>

                      <p className="text-[13px] text-text-muted mt-2.5 leading-relaxed">{it.description}</p>

                      {it.includes && it.includes.length > 0 && (
                        <ul className="mt-2.5 space-y-1">
                          {it.includes.map((inc, i) => (
                            <li key={i} className="flex gap-2 text-[12px] text-text-muted">
                              <Sparkles className="h-3.5 w-3.5 text-accent/70 shrink-0 mt-0.5" />
                              <span>{inc}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-auto pt-3.5 flex items-center gap-2">
                        {it.weeks && <span className="text-[11px] text-text-dim">{it.weeks} нед.</span>}
                        <div className="flex-1" />
                        {isOwned && installed.has(it.id) ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => install(it)}
                              disabled={busy}
                              title="Переустановить в планер"
                              className="inline-flex items-center rounded-lg bg-bg-soft hover:bg-bg-hover text-text-muted px-2.5 py-2 text-xs disabled:opacity-60"
                            >
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Обновить'}
                            </button>
                            <button
                              onClick={() => { it.kind === 'hub' ? openWorkoutHub(it.id) : openProgram(it.id); onClose(); }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-white px-3.5 py-2 text-sm font-medium"
                            >
                              <PlayCircle className="h-4 w-4" /> Открыть
                            </button>
                          </div>
                        ) : isOwned ? (
                          <button
                            onClick={() => install(it)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-white px-3.5 py-2 text-sm font-medium disabled:opacity-60"
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isDone ? <Check className="h-4 w-4" /> : null}
                            {isDone ? 'Установлено' : 'Установить'}
                          </button>
                        ) : (
                          <a
                            href={it.buyUrl}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-white px-3.5 py-2 text-sm font-medium"
                          >
                            Купить <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-5 flex items-center gap-2 text-[11px] text-text-dim leading-relaxed">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            После оплаты придёт ключ THEDAD-… — нажми «Есть ключ» и вставь его. Программа установится локально, ничего не уходит в облако.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
};
