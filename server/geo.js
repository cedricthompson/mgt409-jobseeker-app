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
  drive: { factor: 1.3, kmh: 40, fixed: 5 },
  transit: { factor: 1.3, kmh: 25, fixed: 12 }, // typical of rail plus bus systems like WMATA or the MTA
  bike: { factor: 1.2, kmh: 15, fixed: 2 },
  walk: { factor: 1.2, kmh: 5, fixed: 0 },
};

export function commuteMinutes(from, to, mode = "drive") {
  if (!from || !to) return null;
  const m = MODES[mode] || MODES.drive;
  return Math.round((km(from, to) * m.factor / m.kmh) * 60 + m.fixed);
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

// Best available commute time: real routing if a key is set, otherwise the estimate.
export async function commute(from, to, mode = "drive") {
  const routed = await routedMinutes(from, to, mode);
  return routed != null
    ? { minutes: routed, method: "routed" }
    : { minutes: commuteMinutes(from, to, mode), method: "estimate" };
}
