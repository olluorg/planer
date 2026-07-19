import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Play, Pause, SkipForward, SkipBack, X, Volume2, VolumeX, ChevronDown, ChevronUp, Youtube, Waves,
} from 'lucide-react';
import { useYtPlayer, ytThumb } from '@/lib/ytPlayer';
import { useSoundscape } from '@/lib/soundscape';
import { toast } from '@/lib/toast';

// Коды ошибок YouTube, означающие «этот ролик нельзя воспроизвести встроенным плеером»:
// 100 — удалён/приватный, 101 и 150 — владелец запретил встраивание, 153 — реферер/встраивание.
const UNPLAYABLE = new Set([100, 101, 150, 153]);

/**
 * Глобальный мини-плеер (правый нижний угол, как системная панель воспроизведения).
 * Владеет ЕДИНСТВЕННЫМ YouTube-iframe приложения — поэтому музыка не обрывается при выходе
 * из Focus Mode. Управляет всем звуком: YouTube + «Атмосфера» (soundscape).
 * z выше FocusMode (z-[200]), чтобы плеер оставался доступен и в фокусе.
 */
export const MiniPlayer: React.FC = () => {
  const {
    list, activeId, playing, volume, showVideo,
    setFrame, register, togglePlay, next, prev, stop, setVolume, toggleVideo,
  } = useYtPlayer();
  const { mix, master, paused: soundPaused, setMaster, togglePause, stopAll } = useSoundscape();

  const item = list.find((x) => x.id === activeId) ?? null;
  const soundLayers = Object.keys(mix).length;

  // Ролики, которые YouTube отказался встроить, — чтобы не зациклиться на пропусках
  const failedRef = useRef<Set<string>>(new Set());
  // Слушаем события YouTube-плеера: на ошибку встраивания сами уходим на следующий доступный трек
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      // сообщения приходят от youtube-nocookie.com — фильтруем по источнику
      if (typeof e.data !== 'string' || !/\.youtube(-nocookie)?\.com$/.test(e.origin.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))) return;
      let data: any;
      try { data = JSON.parse(e.data); } catch { return; }
      if (data?.event === 'onError' && UNPLAYABLE.has(Number(data.info))) {
        const st = useYtPlayer.getState();
        const failedId = st.activeId;
        const nextId = st.skipUnplayable(failedRef.current);
        if (nextId) {
          toast.error('Ролик нельзя встроить', 'Пропустил на следующий трек');
        } else {
          toast.error('Эти ролики нельзя встроить', 'Открой на YouTube или включи «Атмосферу»');
        }
        if (failedId) failedRef.current.add(failedId);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Системная панель Windows/медиаклавиши: отдаём название трека и обработчики
  useEffect(() => {
    const ms = (navigator as any).mediaSession;
    const MM = (window as any).MediaMetadata;
    if (!ms || !MM || !item) return;
    try {
      ms.metadata = new MM({
        title: item.title,
        artist: 'THEDAD · Focus',
        artwork: [{ src: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }],
      });
      ms.playbackState = playing ? 'playing' : 'paused';
      ms.setActionHandler('play', () => { if (!playing) togglePlay(); });
      ms.setActionHandler('pause', () => { if (playing) togglePlay(); });
      ms.setActionHandler('nexttrack', () => next());
      ms.setActionHandler('previoustrack', () => prev());
    } catch {}
  }, [item, playing, togglePlay, next, prev]);

  if (!activeId && soundLayers === 0) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[210] w-[320px] rounded-2xl bg-bg-card/95 backdrop-blur-xl border border-border shadow-2xl overflow-hidden">
      {/* ЕДИНСТВЕННЫЙ iframe приложения. Свёрнутое видео прячем высотой, а не display:none
          и не размонтированием — иначе плеер перезагрузится и звук оборвётся. */}
      {activeId && (
        <div className={showVideo ? 'aspect-video bg-black' : 'h-0 overflow-hidden'}>
          <iframe
            ref={setFrame}
            // реальный размер даже в свёрнутом виде (обрезается контейнером):
            // нулевой/display:none iframe YouTube может остановить воспроизведение
            className={showVideo ? 'w-full h-full' : 'w-full h-[180px]'}
            src={`https://www.youtube-nocookie.com/embed/${activeId}?autoplay=1&rel=0&enablejsapi=1`}
            title="THEDAD плеер"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={() => { setVolume(volume); register(); }}
          />
        </div>
      )}

      {/* YouTube-строка */}
      {activeId && (
        <div className="p-3">
          <div className="flex items-center gap-2.5">
            <img src={ytThumb(activeId)} alt="" className="h-10 w-14 rounded-lg object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-text truncate">{item?.title ?? 'YouTube'}</div>
              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                <Youtube className="h-3 w-3 text-red-500" /> {playing ? 'играет' : 'пауза'}
              </div>
            </div>
            <button onClick={toggleVideo} className="h-7 w-7 rounded-lg text-text-muted hover:text-text hover:bg-bg-soft flex items-center justify-center transition-colors" title={showVideo ? 'Свернуть видео' : 'Показать видео'}>
              {showVideo ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            <button onClick={stop} className="h-7 w-7 rounded-lg text-text-muted hover:text-danger hover:bg-bg-soft flex items-center justify-center transition-colors" title="Остановить">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 mt-2">
            <button onClick={prev} className="h-8 w-8 rounded-lg text-text-muted hover:text-text hover:bg-bg-soft flex items-center justify-center transition-colors" title="Предыдущий">
              <SkipBack className="h-4 w-4" />
            </button>
            <button onClick={togglePlay} className="h-9 w-9 rounded-full bg-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity" title={playing ? 'Пауза' : 'Играть'}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
            </button>
            <button onClick={next} className="h-8 w-8 rounded-lg text-text-muted hover:text-text hover:bg-bg-soft flex items-center justify-center transition-colors" title="Следующий">
              <SkipForward className="h-4 w-4" />
            </button>
            <button onClick={() => setVolume(volume === 0 ? 70 : 0)} className="h-8 w-8 rounded-lg text-text-muted hover:text-text hover:bg-bg-soft flex items-center justify-center transition-colors ml-1" title="Звук">
              {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range" min="0" max="100" step="5" value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1 accent-accent min-w-0"
              title="Громкость видео"
            />
          </div>
        </div>
      )}

      {/* Атмосфера (soundscape) */}
      {soundLayers > 0 && (
        <div className={`p-3 ${activeId ? 'border-t border-border-soft' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Waves className="h-4 w-4 text-accent" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-text truncate">Атмосфера</div>
              <div className="text-[10px] text-text-muted">{soundLayers} {soundLayers === 1 ? 'слой' : 'слоя'} · {soundPaused ? 'пауза' : 'играет'}</div>
            </div>
            <button onClick={togglePause} className="h-8 w-8 rounded-lg text-text-muted hover:text-text hover:bg-bg-soft flex items-center justify-center transition-colors" title={soundPaused ? 'Продолжить' : 'Пауза'}>
              {soundPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button onClick={stopAll} className="h-8 w-8 rounded-lg text-text-muted hover:text-danger hover:bg-bg-soft flex items-center justify-center transition-colors" title="Выключить атмосферу">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Volume2 className="h-3.5 w-3.5 text-text-dim shrink-0" />
            <input
              type="range" min="0" max="1" step="0.05" value={master}
              onChange={(e) => setMaster(Number(e.target.value))}
              className="flex-1 accent-accent min-w-0"
              title="Громкость атмосферы"
            />
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};
