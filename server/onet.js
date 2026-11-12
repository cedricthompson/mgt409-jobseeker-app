// O*NET occupation data (U.S. Department of Labor), used to ground the skills match.
// data/onet.json is a compact copy of O*NET 31.0 built from its public CSV files: for each occupation, the most
// important skills and knowledge areas (O*NET importance 3 or higher out of 5) and its in-demand software, plus
// 45,000+ job titles mapped to occupations. Source and license (CC BY 4.0) are recorded in the file.
import { readFileSync } from "node:fs";

const ONET = JSON.parse(readFileSync(new URL("./data/onet.json", import.meta.url)));
export const ONET_SOURCE = ONET.source;

const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
// Words that say how senior or what kind of posting it is, not what the work is.
const NOISE = new Set(["senior", "sr", "junior", "jr", "lead", "i", "ii", "iii", "iv", "the", "and", "of", "for", "a", "an", "to", "in",
  "remote", "hybrid", "part", "full", "time", "temporary", "contract", "level", "entry", "associate", "assistant"]);
const words = (t) => norm(t).split(" ").filter((w) => w.length > 1 && !NOISE.has(w));

// Index title words once, so finding candidates for a job title doesn't scan all 45,000 titles.
const index = new Map();
for (const [title, code] of Object.entries(ONET.titles)) {
  for (const w of new Set(words(title))) {
    if (!index.has(w)) index.set(w, []);
    index.get(w).push([title, code]);
  }
}

export const occupation = (code) => (code && ONET.occupations[code] ? { code, ...ONET.occupations[code] } : null);

// The O*NET occupations that best match a job title: an exact title match first, then the titles sharing
// the most words with it. Returns up to `n` distinct occupations for the model to choose from.
export function candidates(jobTitle, n = 3) {
  const exact = ONET.titles[norm(jobTitle)];
  const want = words(jobTitle);
  const scores = new Map();
  for (const w of new Set(want)) {
    for (const [title, code] of index.get(w) || []) {
      const tw = words(title);
      const shared = tw.filter((x) => want.includes(x)).length;
      const score = shared / (want.length + tw.length - shared); // Jaccard overlap of the two titles
      if (score > (scores.get(code) || 0)) scores.set(code, score);
    }
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
  const codes = [...new Set([exact, ...ranked].filter(Boolean))].filter((c) => ONET.occupations[c]).slice(0, n);
  return codes.map(occupation);
}

// Other common job titles for the same work, used to widen a job search when the applicant's own titles don't
// turn up enough jobs they have a real chance at (e.g. "help desk technician" -> "computer support specialist").
// O*NET lists many titles per occupation; the ones built from the words that occupation's titles use most
// (computer, support, specialist...) are the plain titles employers post, so those come first.
const byOccupation = new Map();
for (const [title, code] of Object.entries(ONET.titles)) {
  if (!byOccupation.has(code)) byOccupation.set(code, []);
  byOccupation.get(code).push(title.split("  ")[0]); // "prep cook  preparation cook" -> "prep cook"
}
const titleCase = (t) => t.replace(/\b[a-z]/g, (c) => c.toUpperCase());
export function relatedTitles(jobTitles = [], n = 3) {
  const have = new Set(jobTitles.map(norm));
  const out = [];
  for (const t of jobTitles) {
    const occ = candidates(t, 1)[0];
    if (!occ) continue;
    const list = [...new Set(byOccupation.get(occ.code) || [])]
      .filter((x) => { const w = x.split(" "); return w.length >= 2 && w.length <= 3 && w.every((y) => y.length >= 4 || y === "it"); });
    const freq = new Map();
    for (const x of list) for (const w of new Set(x.split(" "))) freq.set(w, (freq.get(w) || 0) + 1);
    const score = (x) => x.split(" ").reduce((s, w) => s + freq.get(w), 0) / x.split(" ").length;
    const picks = list.filter((x) => !have.has(norm(x))).sort((a, b) => score(b) - score(a) || a.length - b.length);
    for (const x of picks.slice(0, 2)) { if (!have.has(x)) { have.add(x); out.push(titleCase(x)); } }
  }
  return out.slice(0, n);
}
