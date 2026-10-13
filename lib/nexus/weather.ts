/** Workbench weather helpers (Open-Meteo WMO codes + city defaults). */
export const DEFAULT_WEATHER_CITY = '杭州';

/** Cap city name length for prefs / API. */
export function normalizeWeatherCity(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_WEATHER_CITY;
  const s = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
  return s || DEFAULT_WEATHER_CITY;
}

/** WMO Weather interpretation codes → short Chinese label. */
export function weatherLabel(code: number): string {
  if (code === 0) return '晴';
  if (code === 1) return '晴间多云';
  if (code === 2) return '多云';
  if (code === 3) return '阴';
  if (code === 45 || code === 48) return '雾';
  if (code === 51 || code === 53 || code === 55) return '毛毛雨';
  if (code === 56 || code === 57) return '冻毛毛雨';
  if (code === 61 || code === 63 || code === 65) return '雨';
  if (code === 66 || code === 67) return '冻雨';
  if (code === 71 || code === 73 || code === 75 || code === 77) return '雪';
  if (code === 80 || code === 81 || code === 82) return '阵雨';
  if (code === 85 || code === 86) return '阵雪';
  if (code === 95) return '雷雨';
  if (code === 96 || code === 99) return '雷阵雨伴冰雹';
  return '未知';
}

/** Pick a lucide-ish emoji/glyph for the preview chip. */
export function weatherGlyph(code: number): string {
  if (code === 0 || code === 1) return '☀️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}

export type WeatherDay = { date: string; code: number; label: string; high: number; low: number };
export type WeatherPayload = {
  city: string;
  resolved: string;
  latitude: number;
  longitude: number;
  current: { temp: number; code: number; label: string };
  daily: WeatherDay[];
};
