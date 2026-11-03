import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, isGlass } from '@/lib/theme';
import { getLiveWallpaper, loadVideoWallpaperUrl, LIVEWP_EVENT, type LiveWallpaper } from '@/lib/liveWallpaper';
import { YouTubeBg, VideoBg } from '@/components/LiveWallpaper';

/** Живые обои приложения: рендерятся фоновым слоем в glass-теме, поверх статичных
 *  обоев (их прячем классом live-wp), со своей затемняющей вуалью для читаемости.
 *  `suspended` — Focus Mode открыт со своим фоном: гасим обои главной, чтобы не крутить
 *  две видео-iframe одновременно (лишняя нагрузка + возможная накладка звука). */
export const AppLiveWallpaper: React.FC<{ suspended?: boolean }> = ({ suspended }) => {
  const { theme } = useTheme();
  const [wp, setWp] = useState<LiveWallpaper | null>(getLiveWallpaper);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const sync = () => setWp(getLiveWallpaper());
    window.addEventListener(LIVEWP_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(LIVEWP_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  const active = isGlass(theme) && !!wp && !suspended && !reducedMotion;

  useEffect(() => { setVideoReady(false); }, [wp, active]);

  // Прячем статичные обои, пока активны живые
  useEffect(() => {
    document.documentElement.classList.toggle('live-wp', active && (wp?.kind === 'youtube' || videoReady));
    return () => document.documentElement.classList.remove('live-wp');
  }, [active, wp, videoReady]);

  // Object URL для видео-обоев
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    if (active && wp?.kind === 'video') {
      void loadVideoWallpaperUrl(wp.ref).then((u) => { if (cancelled) { if (u) URL.revokeObjectURL(u); return; } url = u; setVideoUrl(u); });
    } else {
      setVideoUrl(null);
    }
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [active, wp]);

  if (!active || !wp) return null;

  return createPortal(
    <div className="fixed inset-0 -z-[1] pointer-events-none">
      {wp.kind === 'youtube' && <YouTubeBg id={wp.ref} />}
      {wp.kind === 'video' && videoUrl && <VideoBg src={videoUrl} onReady={() => setVideoReady(true)} onError={() => setVideoReady(false)} />}
      {wp.kind === 'builtin' && <VideoBg src={wp.ref} onReady={() => setVideoReady(true)} onError={() => setVideoReady(false)} />}
      {/* затемнение для читаемости панелей */}
      {(wp.kind === 'youtube' || videoReady) && <div className="absolute inset-0 bg-black/60" />}
    </div>,
    document.body,
  );
};
