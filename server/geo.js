// Free geocoding (OpenStreetMap Nominatim, no key) and a simple commute estimate.
// Nominatim asks for a descriptive User-Agent and light use, so results are cached.
const cache = new Map();

export async function geocode(place) {
  if (!place || /remote|multiple|negotiable/i.test(place)) return null;
  if (cache.has(place)) return cache.get(place);
  let point = null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(place)}`, {
      headers: { "User-Agent": "MGT409-JobSeeker-App (student project)" }, signal: AbortSignal.timeout(5000),
    });
    const [hit] = await res.json();
    if (hit) point = { lat: Number(hit.lat), lng: Number(hit.lon) };
  } catch { /* no point: commute score falls back to unknown */ }
  cache.set(place, point);
  return point;
}

function km(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// Rough door-to-door estimates when no routing key is set:
// straight-line distance x route factor, at an average speed, plus fixed time (parking, or walking and waiting).
const MODES = {
  drive: { factor: 1.2, kmh: 40, fixed: 5 },
  transit: { factor: 1.3, kmh: 25, fixed: 12 }, // typical of rail plus bus systems like WMATA or the MTA
  bike: { factor: 1.2, kmh: 15, fixed: 2 },
  walk: { factor: 1.2, kmh: 5, fixed: 0 },
};

// Metro areas and their transit systems. Speeds are rough door-to-door averages, including walking,
// waiting, and transfers. Driving is slower in dense, congested metros. "transit" as the default mode
// means most workers there without a stated preference are assumed to ride transit.
const METROS = [
  { name: "Washington, DC", lat: 38.9, lng: -77.04, radius: 55, system: "Metro (WMATA)", transitKmh: 24, driveKmh: 30, defaultMode: "transit" },
  { name: "New York City", lat: 40.73, lng: -73.94, radius: 50, system: "subway and bus (MTA)", transitKmh: 22, driveKmh: 22, defaultMode: "transit" },
  { name: "Chicago", lat: 41.88, lng: -87.63, radius: 45, system: "L and bus (CTA)", transitKmh: 22, driveKmh: 30, defaultMode: "transit" },
  { name: "Boston", lat: 42.36, lng: -71.06, radius: 40, system: "T (MBTA)", transitKmh: 21, driveKmh: 28, defaultMode: "transit" },
  { name: "San Francisco Bay Area", lat: 37.77, lng: -122.42, radius: 50, system: "BART and Muni", transitKmh: 24, driveKmh: 30, defaultMode: "transit" },
  { name: "Philadelphia", lat: 39.95, lng: -75.17, radius: 40, system: "SEPTA", transitKmh: 20, driveKmh: 32, defaultMode: "drive" },
  { name: "Baltimore", lat: 39.29, lng: -76.61, radius: 35, system: "MTA Maryland", transitKmh: 18, driveKmh: 38, defaultMode: "drive" },
  { name: "Atlanta", lat: 33.75, lng: -84.39, radius: 50, system: "MARTA", transitKmh: 20, driveKmh: 38, defaultMode: "drive" },
  { name: "Seattle", lat: 47.61, lng: -122.33, radius: 45, system: "Link and King County Metro", transitKmh: 21, driveKmh: 32, defaultMode: "drive" },
  { name: "Los Angeles", lat: 34.05, lng: -118.24, radius: 70, system: "LA Metro", transitKmh: 18, driveKmh: 35, defaultMode: "drive" },
  { name: "Denver", lat: 39.74, lng: -104.99, radius: 40, system: "RTD", transitKmh: 19, driveKmh: 42, defaultMode: "drive" },
  { name: "Columbus", lat: 39.96, lng: -83.0, radius: 35, system: "COTA bus", transitKmh: 15, driveKmh: 45, defaultMode: "drive" },
];

export function metroFor(point) {
  if (!point) return null;
  return METROS.find((m) => km(point, m) <= m.radius) || null;
}

const HIGHWAY_KMH = 80;

export function commuteMinutes(from, to, mode = "drive", metro = null) {
  if (!from || !to) return null;
  const m = { ...(MODES[mode] || MODES.drive) };
  const road = km(from, to) * m.factor;
  if (mode === "drive") {
    // First 10 km at city speed, the rest at highway speed.
    const city = metro?.driveKmh ?? m.kmh;
    return Math.round((Math.min(road, 10) / city + Math.max(road - 10, 0) / HIGHWAY_KMH) * 60 + m.fixed);
  }
  if (metro && mode === "transit") m.kmh = metro.transitKmh;
  return Math.round((road / m.kmh) * 60 + m.fixed);
}

// Real transit times from Google's Routes API, which uses each agency's own schedules
// (WMATA in DC, the MTA in New York, CTA in Chicago, and so on). Optional: set GOOGLE_MAPS_API_KEY.
const GMODE = { drive: "DRIVE", transit: "TRANSIT", bike: "BICYCLE", walk: "WALK" };
export async function routedMinutes(from, to, mode = "drive") {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !from || !to) return null;
  const point = (p) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.duration" },
      body: JSON.stringify({ origin: point(from), destination: point(to), travelMode: GMODE[mode] || "DRIVE" }),
      signal: AbortSignal.timeout(6000),
    });
    const seconds = parseInt((await res.json()).routes?.[0]?.duration, 10);
    return Number.isFinite(seconds) ? Math.round(seconds / 60) : null;
  } catch {
    return null;
  }
}

// Best available commute time, based on where the applicant lives and where the job is.
// - No stated mode: use the home metro's usual mode (transit in DC, NYC, Chicago, Boston, SF; driving elsewhere).
// - Transit only counts when home and job are in the same metro system; otherwise it falls back to driving.
// - Real routing if a key is set, otherwise the estimate.
export async function commute(from, to, preferred = null) {
  const homeMetro = metroFor(from), jobMetro = metroFor(to);
  let mode = preferred || homeMetro?.defaultMode || "drive";
  let note = "";
  if (mode === "transit" && homeMetro && jobMetro && homeMetro !== jobMetro) {
    mode = "drive";
    note = `outside the ${homeMetro.system} area, so driving time is shown`;
  }
  const system = mode === "transit" ? homeMetro?.system || "public transit" : null;
  const routed = await routedMinutes(from, to, mode);
  return {
    minutes: routed ?? commuteMinutes(from, to, mode, homeMetro),
    method: routed != null ? "routed" : "estimate", mode, system, note,
  };
}
