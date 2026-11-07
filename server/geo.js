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

// Rough drive time: straight-line distance x 1.3 for roads, at 40 km/h average, plus 5 minutes to park.
// Good enough to compare jobs; a maps API could replace it later.
export function commuteMinutes(from, to) {
  if (!from || !to) return null;
  return Math.round((km(from, to) * 1.3 / 40) * 60 + 5);
}
