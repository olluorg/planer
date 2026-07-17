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

export interface ForecastHour { time: string; temp: number; kind: Weather['kind'] }
export interface ForecastDay { date: string; min: number; max: number; kind: Weather['kind']; precip: number }
export interface Forecast { hourly: ForecastHour[]; daily: ForecastDay[] }

const FKEY = 'thedad.forecast.v1';
const FTTL = 30 * 60 * 1000;

/** Почасовой (сутки вперёд) и подневный (до 14 дней) прогноз. Open-Meteo, без ключа. */
export async function getForecast(): Promise<Forecast | null> {
  try {
    const cached = JSON.parse(localStorage.getItem(FKEY) ?? 'null') as { at: number; f: Forecast | null } | null;
    if (cached && Date.now() - cached.at < FTTL) return cached.f;
    if (!('geolocation' in navigator)) return null;
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, maximumAge: TTL }),
    );
    const { latitude, longitude } = pos.coords;
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}`
      + `&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max`
      + `&forecast_days=14&timezone=auto`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const nowH = new Date().getHours() + new Date().getDate() * 24; // грубый ключ «с этого часа»
    const hourly: ForecastHour[] = (j.hourly?.time ?? [])
      .map((t: string, i: number) => ({ time: t, temp: Math.round(j.hourly.temperature_2m[i]), kind: kindFromCode(j.hourly.weather_code[i]) }))
      .filter((h: ForecastHour) => { const d = new Date(h.time); return d.getHours() + d.getDate() * 24 >= nowH; })
      .slice(0, 24);
    const daily: ForecastDay[] = (j.daily?.time ?? []).map((d: string, i: number) => ({
      date: d,
      max: Math.round(j.daily.temperature_2m_max[i]),
      min: Math.round(j.daily.temperature_2m_min[i]),
      kind: kindFromCode(j.daily.weather_code[i]),
      precip: j.daily.precipitation_probability_max?.[i] ?? 0,
    }));
    const f: Forecast = { hourly, daily };
    localStorage.setItem(FKEY, JSON.stringify({ at: Date.now(), f }));
    return f;
  } catch {
    try { localStorage.setItem(FKEY, JSON.stringify({ at: Date.now(), f: null })); } catch {}
    return null;
  }
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
