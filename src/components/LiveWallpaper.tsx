/** Видео-фоны, покрывающие вьюпорт: YouTube (муты+луп) и локальное видео.
 *  Используются и как «живые обои» приложения (glass), и как фон Focus Mode. */

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
export const YouTubeBg: React.FC<{ id: string; className?: string }> = ({ id, className }) => {
  const src = `https://www.youtube-nocookie.com/embed/${id}`
    + `?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1`
    + `&rel=0&playsinline=1&disablekb=1&fs=0&iv_load_policy=3`;
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ''}`}>
      <iframe src={src} title="Живой фон" style={coverStyle} allow="autoplay; encrypted-media" />
    </div>
  );
};

/** Фон из локального видео-файла (object URL или путь). */
export const VideoBg: React.FC<{ src: string; className?: string }> = ({ src, className }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ''}`}>
    <video
      src={src}
      autoPlay loop muted playsInline
      className="absolute inset-0 h-full w-full object-cover"
    />
  </div>
);
