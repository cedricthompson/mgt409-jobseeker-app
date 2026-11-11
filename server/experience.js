// Years of work experience from a profile. Resume import often stores each job's length as dates
// ("December 2018–Present", "3/2014 – 7/2015", "2010-2012") rather than a number, and Number() of those is 0,
// which made experienced applicants look like they were just starting out. This reads numbers and date ranges,
// and merges overlapping jobs (two roles at once) so the same years aren't counted twice.
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const NOW = () => { const d = new Date(); return d.getFullYear() + d.getMonth() / 12; };

// One date like "December 2018", "Dec 2018", "3/2014", "2014-03", or "2014" -> a year as a decimal (2018.92).
function point(s) {
  const t = String(s).trim().toLowerCase();
  if (/present|current|now|today/.test(t)) return NOW();
  let m = t.match(/([a-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (m && MONTHS[m[1]] != null) return Number(m[2]) + MONTHS[m[1]] / 12;
  m = t.match(/(\d{1,2})\/(\d{4})/) || t.match(/(\d{4})-(\d{1,2})(?!\d)/);
  if (m) return m[1].length === 4 ? Number(m[1]) + (Number(m[2]) - 1) / 12 : Number(m[2]) + (Number(m[1]) - 1) / 12;
  m = t.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

// A job's time span [start, end] in decimal years, or a plain length in years when that's all we have.
function span(e) {
  const y = e?.years;
  if (typeof y === "number") return { length: y };
  const t = String(y ?? e?.dates ?? "").trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?\s*(\+\s*)?(years?|yrs?)?$/i.test(t)) return { length: parseFloat(t) };
  const parts = t.split(/\s*(?:–|—|-|\bto\b|\buntil\b|\bthrough\b)\s*(?=[a-z]|\d{1,2}\/|\d{4})/i).filter(Boolean);
  if (parts.length >= 2) {
    const a = point(parts[0]), b = point(parts[parts.length - 1]);
    if (a != null && b != null && b >= a) return { start: a, end: b };
  }
  const n = parseFloat(t);
  return Number.isFinite(n) && n < 60 ? { length: n } : null;
}

export function yearsOf(e) {
  const s = span(e);
  if (!s) return 0;
  return s.length ?? s.end - s.start;
}

// Total years across all jobs, counting overlapping dates once.
export function totalYears(experience = []) {
  const spans = (experience || []).map(span).filter(Boolean);
  const ranges = spans.filter((s) => s.start != null).sort((a, b) => a.start - b.start);
  let total = spans.filter((s) => s.length != null).reduce((sum, s) => sum + s.length, 0);
  let cur = null;
  for (const r of ranges) {
    if (!cur || r.start > cur.end) { if (cur) total += cur.end - cur.start; cur = { ...r }; }
    else cur.end = Math.max(cur.end, r.end);
  }
  if (cur) total += cur.end - cur.start;
  return Math.round(total * 10) / 10;
}
