/**
 * Geo configuration for Kazakhstan cities.
 * Checklist items #2, #11: strict sync of proxy geo ↔ timezone / locale / geolocation.
 */

export interface GeoConfig {
  timezone: string;
  locale: string;
  language: string;
  geolocation: { latitude: number; longitude: number; accuracy: number };
  googleParams: { gl: string; hl: string; uule: string };
}

// UULE = base64-encoded location for Google (biases local SERP results to exact city).
// Format: "w+CAIQICI" + base64("size:N+latlng:-...,..." )
// Using pre-computed values for KZ cities.
const UULE: Record<string, string> = {
  ALMATY: 'w+CAIQICIkQWxtYXR5LCBLYXpha2hzdGFu',
  ASTANA: 'w+CAIQICIjQXN0YW5hLCBLYXpha2hzdGFu',
  SHYMKENT: 'w+CAIQICIlU2h5bWtlbnQsIEthemFraHN0YW4',
};

const GEO_CONFIGS: Record<string, GeoConfig> = {
  ALMATY: {
    timezone: 'Asia/Almaty',
    locale: 'ru-KZ',
    language: 'ru-KZ,ru;q=0.9,kk;q=0.8',
    geolocation: { latitude: 43.2567, longitude: 76.9286, accuracy: 100 },
    googleParams: { gl: 'kz', hl: 'ru', uule: UULE.ALMATY },
  },
  ASTANA: {
    timezone: 'Asia/Almaty',
    locale: 'ru-KZ',
    language: 'ru-KZ,ru;q=0.9,kk;q=0.8',
    geolocation: { latitude: 51.1801, longitude: 71.4460, accuracy: 100 },
    googleParams: { gl: 'kz', hl: 'ru', uule: UULE.ASTANA },
  },
  SHYMKENT: {
    timezone: 'Asia/Almaty',
    locale: 'ru-KZ',
    language: 'ru-KZ,ru;q=0.9,kk;q=0.8',
    geolocation: { latitude: 42.3000, longitude: 69.6000, accuracy: 100 },
    googleParams: { gl: 'kz', hl: 'ru', uule: UULE.SHYMKENT },
  },
};

// Checklist #21: geo-diversity within KZ to avoid squashing.
// Distribution matches approximate real search traffic: Almaty ~55%, Astana ~30%, Shymkent ~15%.
const ALL_GEO_WEIGHTS: Array<{ city: string; weight: number }> = [
  { city: 'ALMATY',   weight: 0.55 },
  { city: 'ASTANA',   weight: 0.30 },
  { city: 'SHYMKENT', weight: 0.15 },
];

function pickCityFromAll(): string {
  const r = Math.random();
  let cumulative = 0;
  for (const entry of ALL_GEO_WEIGHTS) {
    cumulative += entry.weight;
    if (r < cumulative) return entry.city;
  }
  return 'ALMATY';
}

export function getGeoConfig(city: string): GeoConfig {
  const resolved = city === 'ALL' ? pickCityFromAll() : city;
  return GEO_CONFIGS[resolved] ?? GEO_CONFIGS.ALMATY;
}

export function buildGoogleSearchUrl(keyword: string, geo: GeoConfig): string {
  const q = encodeURIComponent(keyword);
  const { gl, hl, uule } = geo.googleParams;
  // num=100 is a strong bot signal — real users never request 100 results.
  // Use default page size (10) to avoid triggering Google's bot detection.
  return `https://www.google.kz/search?q=${q}&gl=${gl}&hl=${hl}&uule=${uule}`;
}
