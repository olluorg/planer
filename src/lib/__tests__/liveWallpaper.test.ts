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

  it('keeps the previous video if saving a YouTube selection fails', async () => {
    const wallpaper = await import('../liveWallpaper');
    localStorage.setItem('app.livewallpaper.v1', JSON.stringify({ kind: 'video', ref: 'old' }));
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('storage full'); });
    try {
      expect(() => wallpaper.setYouTubeWallpaper('abcdefghijk')).toThrow('storage full');
      expect(wallpaper.getLiveWallpaper()).toEqual({ kind: 'video', ref: 'old' });
      expect(storage.del).not.toHaveBeenCalled();
    } finally { setItem.mockRestore(); }
  });

  it('deletes the new video and keeps the old selection if its config cannot be saved', async () => {
    const wallpaper = await import('../liveWallpaper');
    localStorage.setItem('app.livewallpaper.v1', JSON.stringify({ kind: 'video', ref: 'old' }));
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('storage full'); });
    try {
      await expect(wallpaper.setVideoWallpaper(new File(['video'], 'clip.mp4'))).rejects.toThrow('storage full');
      expect(wallpaper.getLiveWallpaper()).toEqual({ kind: 'video', ref: 'old' });
      expect(storage.del).toHaveBeenCalledOnce();
      expect(storage.del).not.toHaveBeenCalledWith('old');
    } finally { setItem.mockRestore(); }
  });
});
