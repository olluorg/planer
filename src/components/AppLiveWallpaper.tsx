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

  useEffect(() => {
    const sync = () => setWp(getLiveWallpaper());
    window.addEventListener(LIVEWP_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(LIVEWP_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  const active = isGlass(theme) && !!wp && !suspended;

  // Прячем статичные обои, пока активны живые
  useEffect(() => {
    document.documentElement.classList.toggle('live-wp', active);
    return () => document.documentElement.classList.remove('live-wp');
  }, [active]);

  // Object URL для видео-обоев
  useEffect(() => {
    let url: string | null = null;
    if (active && wp?.kind === 'video') {
      void loadVideoWallpaperUrl(wp.ref).then((u) => { url = u; setVideoUrl(u); });
    } else {
      setVideoUrl(null);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [active, wp]);

  if (!active || !wp) return null;

  return createPortal(
    <div className="fixed inset-0 -z-[1] pointer-events-none">
      {wp.kind === 'youtube' && <YouTubeBg id={wp.ref} />}
      {wp.kind === 'video' && videoUrl && <VideoBg src={videoUrl} />}
      {/* затемнение для читаемости панелей */}
      <div className="absolute inset-0 bg-black/45" />
    </div>,
    document.body,
  );
};
