/** Видео-фоны, покрывающие вьюпорт: YouTube (муты+луп) и локальное видео.
 *  Используются и как «живые обои» приложения (glass), и как фон Focus Mode. */
import { useEffect, useRef } from 'react';

/** Извлекает 11-символьный YouTube-ID из ссылки или самого id. */
export function parseYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(url.trim()) ? url.trim() : null);
}

const coverStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '100vw',
  height: '56.25vw',       // 16:9
  minWidth: '177.78vh',    // покрываем и по высоте
  minHeight: '100vh',
  transform: 'translate(-50%, -50%)',
  border: 0,
  pointerEvents: 'none',
};

/** Фон из YouTube-видео: без звука, зациклено, без контролов. */
export const YouTubeBg: React.FC<{ id: string; className?: string; onPlaying?: () => void; onUnavailable?: () => void; waitForPlayback?: boolean }> = ({ id, className, onPlaying, onUnavailable, waitForPlayback = false }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const callbacks = useRef({ onPlaying, onUnavailable });
  callbacks.current = { onPlaying, onUnavailable };
  useEffect(() => {
    if (!waitForPlayback) return;
    let playing = false;
    const listen = () => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'background' }), 'https://www.youtube-nocookie.com');
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube-nocookie.com' || event.source !== frame.current?.contentWindow) return;
      let data: { event?: string; info?: unknown };
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (!data || typeof data !== 'object') return;
      if (data.event === 'onReady') {
        for (const eventName of ['onStateChange', 'onError']) frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: [eventName] }), 'https://www.youtube-nocookie.com');
      }
      const state = data.event === 'onStateChange' ? data.info : data.event === 'infoDelivery' && data.info && typeof data.info === 'object' ? (data.info as { playerState?: number }).playerState : undefined;
      if (state === 1) { playing = true; callbacks.current.onPlaying?.(); }
      if (data.event === 'onError') { playing = false; callbacks.current.onUnavailable?.(); }
    };
    window.addEventListener('message', onMessage);
    const interval = window.setInterval(listen, 500);
    const timeout = window.setTimeout(() => { if (!playing) callbacks.current.onUnavailable?.(); }, 15000);
    return () => { window.removeEventListener('message', onMessage); window.clearInterval(interval); window.clearTimeout(timeout); };
  }, [id, waitForPlayback]);
  const src = `https://www.youtube-nocookie.com/embed/${id}`
    + `?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1`
    + `&rel=0&playsinline=1&disablekb=1&fs=0&iv_load_policy=3&enablejsapi=1`;
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ''}`}>
      <iframe ref={frame} src={src} title="Живой фон" style={coverStyle} allow="autoplay; encrypted-media" />
    </div>
  );
};

/** Фон из локального видео-файла (object URL или путь). */
export const VideoBg: React.FC<{ src: string; className?: string; onReady?: () => void; onError?: () => void }> = ({ src, className, onReady, onError }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ''}`}>
    <video
      src={src}
      autoPlay loop muted playsInline
      onCanPlay={onReady} onError={onError}
      className="absolute inset-0 h-full w-full object-cover"
    />
  </div>
);
