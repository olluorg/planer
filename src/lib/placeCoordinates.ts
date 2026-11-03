export function parsePlaceCoordinates(input: string): { lat: number; lon: number } | null {
  const value = input.trim();
  let latitude: string | null = null;
  let longitude: string | null = null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['openstreetmap.org', 'www.openstreetmap.org'].includes(url.hostname)) return null;
    const markerLat = url.searchParams.get('mlat');
    const markerLon = url.searchParams.get('mlon');
    if (markerLat !== null || markerLon !== null) {
      latitude = markerLat; longitude = markerLon;
    } else {
      const match = url.hash.match(/^#map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)(?:\/.*)?$/);
      if (match) [, latitude, longitude] = match;
    }
  } catch {
    const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
      ?? value.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*;\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (match) [, latitude, longitude] = match;
  }
  if (latitude === null || longitude === null || !/^-?\d+(?:[.,]\d+)?$/.test(latitude) || !/^-?\d+(?:[.,]\d+)?$/.test(longitude)) return null;
  const lat = Number(latitude.replace(',', '.')), lon = Number(longitude.replace(',', '.'));
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? {lat, lon} : null;
}
