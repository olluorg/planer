// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ set: vi.fn(), del: vi.fn(), get: vi.fn() }));
vi.mock('idb-keyval', () => storage);

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  storage.set.mockReset().mockResolvedValue(undefined);
  storage.del.mockReset().mockResolvedValue(undefined);
  storage.get.mockReset();
});

describe('wallpaper selection', () => {
  it('does not let slow video cleanup undo a later YouTube selection', async () => {
    const wallpaper = await import('../liveWallpaper');
    localStorage.setItem('app.livewallpaper.v1', JSON.stringify({ kind: 'video', ref: 'old' }));
    let finish!: () => void;
    storage.del.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const clearing = wallpaper.clearLiveWallpaper();
    expect(wallpaper.getLiveWallpaper()).toBeNull();
    wallpaper.setYouTubeWallpaper('abcdefghijk');
    finish();
    await clearing;
    expect(wallpaper.getLiveWallpaper()).toEqual({ kind: 'youtube', ref: 'abcdefghijk' });
  });

  it('does not replace a newer selection after a slow video upload', async () => {
    const wallpaper = await import('../liveWallpaper');
    let finish!: () => void;
    storage.set.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const uploading = wallpaper.setVideoWallpaper(new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    wallpaper.setYouTubeWallpaper('abcdefghijk');
    finish();
    await expect(uploading).rejects.toThrow(/Выбор фона изменился/);
    expect(wallpaper.getLiveWallpaper()).toEqual({ kind: 'youtube', ref: 'abcdefghijk' });
    expect(storage.del).toHaveBeenCalledOnce();
  });

  it('removes the previous video when switching to YouTube', async () => {
    const wallpaper = await import('../liveWallpaper');
    localStorage.setItem('app.livewallpaper.v1', JSON.stringify({ kind: 'video', ref: 'old' }));
    wallpaper.setYouTubeWallpaper('abcdefghijk');
    expect(storage.del).toHaveBeenCalledWith('old');
  });
});
