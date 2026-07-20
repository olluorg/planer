import { create } from 'zustand';

/**
 * Глобальный YouTube-плеер. Раньше iframe жил внутри FocusMode и размонтировался при выходе —
 * музыка обрывалась. Теперь состояние здесь, а сам iframe рендерит MiniPlayer в App,
 * поэтому звук продолжается вне фокуса. Управлять можно из фокуса и из мини-плеера.
 */

export interface YtItem { id: string; title: string }

const YT_KEY = 'focus.youtube.v2';
const VOL_KEY = 'yt.volume.v1';
const ACTIVE_KEY = 'yt.active.v1'; // активный трек — чтобы после перезагрузки плеер продолжил

const YT_DEFAULTS: YtItem[] = [
  { id: 'PB8ZrGinWi0', title: 'Focus music · 1' },
  { id: 'X4VbdwhkE10', title: 'Focus music · 2' },
  { id: 'qwosU7e9mqc', title: 'Focus music · 3' },
  { id: 'LEEx_UkHmBU', title: 'Focus music · 4' },
  { id: '68ahXMmMorg', title: 'Skyrim · Ambience' },
  { id: 'YKJ-fkbMOOg', title: 'Focus music · 6' },
];

function loadList(): YtItem[] {
  try {
    // v1 → v2 миграция: докидываем новые дефолты, свои треки сохраняем
    const raw = localStorage.getItem(YT_KEY) ?? localStorage.getItem('focus.youtube.v1');
    if (raw) {
      const saved: YtItem[] = JSON.parse(raw);
      return [...saved, ...YT_DEFAULTS.filter((d) => !saved.some((s) => s.id === d.id))];
    }
  } catch {}
  return YT_DEFAULTS;
}

/** Извлекает 11-символьный YouTube-ID из ссылки или самого id. */
export function parseYtId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(url.trim()) ? url.trim() : null);
}

/** Обложка трека (для мини-плеера и списка). */
export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/default.jpg`;

interface YtState {
  list: YtItem[];
  activeId: string | null;
  playing: boolean;
  volume: number;          // 0..100
  showVideo: boolean;      // мини-плеер развёрнут с картинкой
  frame: HTMLIFrameElement | null;

  setFrame: (el: HTMLIFrameElement | null) => void;
  register: () => void;
  play: (id: string) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  setVolume: (v: number) => void;
  addByUrl: (url: string) => boolean;
  remove: (id: string) => void;
  toggleVideo: () => void;
  /** Текущий ролик не встроился (owner запретил / приватный) — пропустить на следующий доступный.
   *  Возвращает id, на который переключились, или null, если доступных больше нет. */
  skipUnplayable: (failed: Set<string>) => string | null;
  activeItem: () => YtItem | null;
}

export const useYtPlayer = create<YtState>((set, get) => {
  /** Команда плееру через postMessage (iframe с enablejsapi=1). */
  const cmd = (func: string, args: unknown[] = []) => {
    get().frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  };
  const shift = (dir: 1 | -1) => {
    const { list, activeId } = get();
    if (!list.length) return;
    const idx = activeId ? list.findIndex((x) => x.id === activeId) : -1;
    const nextIdx = (idx + dir + list.length) % list.length;
    get().play(list[nextIdx].id);
  };

  const savedActive = (() => { try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; } })();
  const persistActive = (id: string | null) => {
    try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch {}
  };

  return {
    list: loadList(),
    // восстанавливаем активный трек — iframe с autoplay продолжит (звук — по политике браузера, с жеста)
    activeId: savedActive,
    playing: !!savedActive,
    volume: Number(localStorage.getItem(VOL_KEY) || '70'),
    showVideo: false,
    frame: null,

    setFrame: (el) => set({ frame: el }),

    // Рукопожатие с iframe (enablejsapi): без него YouTube не шлёт события, в т.ч. onError.
    // Вызывать после onLoad — тогда мы узнаём про запрет встраивания (коды 101/150/153).
    register: () => {
      get().frame?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'thedad-yt', channel: 'widget' }), '*');
    },

    // Смена трека: src iframe пересобирается по activeId — элемент остаётся смонтированным.
    // Повторный выбор того же трека src не меняет, поэтому будим плеер командой.
    play: (id) => {
      persistActive(id);
      if (get().activeId === id) { cmd('playVideo'); set({ playing: true }); return; }
      set({ activeId: id, playing: true });
    },

    togglePlay: () => {
      const { activeId, playing } = get();
      if (!activeId) return;
      cmd(playing ? 'pauseVideo' : 'playVideo');
      set({ playing: !playing });
    },

    next: () => shift(1),
    prev: () => shift(-1),
    stop: () => { persistActive(null); set({ activeId: null, playing: false }); },

    setVolume: (v) => {
      set({ volume: v });
      try { localStorage.setItem(VOL_KEY, String(v)); } catch {}
      cmd('setVolume', [v]);
      cmd(v === 0 ? 'mute' : 'unMute');
    },

    addByUrl: (url) => {
      const id = parseYtId(url);
      if (!id) return false;
      const list = [...get().list.filter((x) => x.id !== id), { id, title: `Мой трек · ${get().list.length + 1}` }];
      set({ list });
      try { localStorage.setItem(YT_KEY, JSON.stringify(list)); } catch {}
      return true;
    },

    remove: (id) => {
      const list = get().list.filter((x) => x.id !== id);
      set({ list });
      try { localStorage.setItem(YT_KEY, JSON.stringify(list)); } catch {}
      if (get().activeId === id) get().stop();
    },

    skipUnplayable: (failed) => {
      const { list, activeId } = get();
      if (activeId) failed.add(activeId);
      // ищем следующий после текущего, не входящий в список сломанных
      const start = activeId ? list.findIndex((x) => x.id === activeId) : -1;
      for (let i = 1; i <= list.length; i++) {
        const cand = list[(start + i + list.length) % list.length];
        if (cand && !failed.has(cand.id)) { get().play(cand.id); return cand.id; }
      }
      get().stop(); // доступных не осталось
      return null;
    },

    toggleVideo: () => set({ showVideo: !get().showVideo }),
    activeItem: () => get().list.find((x) => x.id === get().activeId) ?? null,
  };
});
