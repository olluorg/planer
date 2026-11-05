import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { APP_ID, youtubeEmbedHeaders } = require('../../../electron/youtube-referrer.cjs');
const { build } = require('../../../package.json');

it('identifies only YouTube embeds in the planner window', () => {
  expect(APP_ID).toBe(build.appId);
  const request = { resourceType: 'subFrame', webContentsId: 5, requestHeaders: { Accept: 'text/html' } };
  expect(youtubeEmbedHeaders(request, 5)).toEqual({ Accept: 'text/html', Referer: `https://${APP_ID}/` });
  expect(youtubeEmbedHeaders(request, 6)).toEqual(request.requestHeaders);
  expect(youtubeEmbedHeaders({ ...request, resourceType: 'mainFrame' }, 5)).toEqual(request.requestHeaders);
  expect(youtubeEmbedHeaders(request, undefined)).toEqual(request.requestHeaders);
  expect(request.requestHeaders).toEqual({ Accept: 'text/html' });
});
