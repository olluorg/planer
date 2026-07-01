/**
 * Погода для шапки дашборда: геолокация + Open-Meteo (без API-ключа).
 * Результат кэшируется на час; при отказе/ошибке возвращается null,
 * UI показывает иконку по времени суток.
 */
export interface Weather {
  temp: number;
  /** WMO weather code → упрощённая категория */
  kind: 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';
}

const KEY = 'thedad.weather.v1';
const TTL = 60 * 60 * 1000;

function kindFromCode(code: number): Weather['kind'] {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

export async function getWeather(): Promise<Weather | null> {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { at: number; w: Weather | null } | null;
    if (cached && Date.now() - cached.at < TTL) return cached.w;

    if (!('geolocation' in navigator)) return null;
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, maximumAge: TTL }),
    );
    const { latitude, longitude } = pos.coords;
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}&current=temperature_2m,weather_code`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const w: Weather = { temp: Math.round(j.current.temperature_2m), kind: kindFromCode(j.current.weather_code) };
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), w }));
    return w;
  } catch {
    // отказ в геолокации или сеть — молча без погоды (и не долбим повторно)
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), w: null })); } catch {}
    return null;
  }
}
