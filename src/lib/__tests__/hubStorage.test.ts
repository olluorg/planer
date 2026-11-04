// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { readHubGoals, readHubPhotos } from '../hubStorage';

beforeEach(() => localStorage.clear());

describe('fitness hub data', () => {
  it('reads existing goals and photos', () => {
    localStorage.setItem('goals', '["Сила"]');
    localStorage.setItem('photos', '{"before":"data:image/jpeg;base64,YWJj"}');
    expect(readHubGoals('goals')).toEqual(['Сила']);
    expect(readHubPhotos('photos')).toEqual({ before: 'data:image/jpeg;base64,YWJj' });
  });
  it.each([
    ['goals', '{broken', readHubGoals],
    ['goals', '[1]', readHubGoals],
    ['photos', '{"before":42}', readHubPhotos],
    ['photos', '{"other":"data:image/jpeg;base64,YWJj"}', readHubPhotos],
  ])('rejects damaged %s without modifying it', (key, raw, read) => {
    localStorage.setItem(key, raw);
    expect(() => read(key)).toThrow('повреждены');
    expect(localStorage.getItem(key)).toBe(raw);
  });
});
