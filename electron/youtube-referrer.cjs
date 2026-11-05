// Keep this in sync with electron-builder's appId in package.json.
const APP_ID = 'app.thedad.planer';

function youtubeEmbedHeaders(details, mainWebContentsId) {
  const headers = { ...details.requestHeaders };
  if (details.resourceType === 'subFrame' && mainWebContentsId != null && details.webContentsId === mainWebContentsId) {
    headers.Referer = `https://${APP_ID}/`;
  }
  return headers;
}

module.exports = { APP_ID, youtubeEmbedHeaders };
