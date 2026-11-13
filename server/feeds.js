// Employers' own public job feeds. Hiring systems like Breezy HR, Greenhouse, and Lever publish each company's
// open positions as a public feed meant for other sites to list, so we read the full list straight from the
// employer: every opening (not just the few Google shows), apply links to the employer, and no JSearch cost.
// Which employers have a feed is set in data/employers.json ("feed": {"type": "breezy", "id": "..."}).
// Feeds are cached for 6 hours. Only job titles and locations are needed to shortlist; the full posting is read
// later, and only for the jobs that get scored (jobDetails).

const FEED_TTL = 6 * 3600e3;
const cache = new Map();
async function getFeed(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < FEED_TTL) return hit.data;
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  return data;
}

const strip = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

// Each hiring system's feed, turned into { title, city, state, remote, url, description? }.
const READERS = {
  breezy: async (id) => (await getFeed(`https://${id}.breezy.hr/json`)).map((p) => ({
    title: p.name, city: p.location?.city || p.location?.name || null, state: p.location?.state?.id || null,
    remote: !!p.location?.is_remote, url: p.url, pay_text: p.salary || null,
  })),
  greenhouse: async (id) => ((await getFeed(`https://boards-api.greenhouse.io/v1/boards/${id}/jobs?content=true`)).jobs || []).map((j) => ({
    title: j.title, ...place(j.location?.name), url: j.absolute_url, description: strip(strip(j.content)), // content is HTML-escaped HTML
  })),
  lever: async (id) => (await getFeed(`https://api.lever.co/v0/postings/${id}?mode=json`)).map((j) => ({
    title: j.text, ...place(j.categories?.location), remote: j.workplaceType === "remote", url: j.hostedUrl,
    description: [j.descriptionPlain, ...(j.lists || []).map((l) => `${l.text}: ${strip(l.content)}`), j.additionalPlain].filter(Boolean).join(" "),
  })),
};

// "Washington, DC" / "Arlington, Virginia" / "Remote - US" -> { city, state, remote }
const STATES = { alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY" };
function place(text) {
  const t = String(text || "");
  const remote = /remote|virtual|anywhere/i.test(t);
  const [city, rest = ""] = t.split(",").map((x) => x.trim());
  const code = rest.match(/\b([A-Z]{2})\b/)?.[1] || STATES[rest.toLowerCase().replace(/[^a-z ]/g, "").trim()] || (/washington,?\s*d\.?c/i.test(t) ? "DC" : null);
  return { city: city || null, state: code, remote };
}

// The states each metro (server/geo.js) draws commuters from, to keep feed jobs near the applicant.
const METRO_STATES = {
  "Washington, DC": ["DC", "VA", "MD"], "New York City": ["NY", "NJ", "CT"], Chicago: ["IL", "IN"], Boston: ["MA", "NH", "RI"],
  "San Francisco Bay Area": ["CA"], Philadelphia: ["PA", "NJ", "DE"], Baltimore: ["MD"], Atlanta: ["GA"], Seattle: ["WA"],
  "Los Angeles": ["CA"], Denver: ["CO"], Columbus: ["OH"],
};

const words = (t) => String(t || "").toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 2 && !STOP.has(w));
const STOP = new Set(["the", "and", "for", "with", "senior", "junior", "lead", "level", "full", "time", "part", "remote", "hybrid", "onsite"]);

// Openings from every feed employer near the applicant, ranked by how many words their titles share with
// the roles being searched for. Returns up to `max` jobs in the app's job shape.
export async function feedJobs(employers, { metro, wantsRemote, roles }, max = 12) {
  const states = METRO_STATES[metro] || [];
  const want = new Set(roles.flatMap(words));
  const lists = await Promise.all(employers.map(async (emp) => {
    try {
      const jobs = await READERS[emp.feed.type](emp.feed.id);
      return { emp, jobs, error: null };
    } catch (err) {
      return { emp, jobs: [], error: err.message };
    }
  }));
  const ranked = [];
  for (const { emp, jobs } of lists) {
    for (const j of jobs) {
      const near = (j.state && states.includes(j.state)) || (j.remote && wantsRemote);
      if (!near) continue;
      const fit = words(j.title).filter((w) => want.has(w)).length;
      if (fit > 0) ranked.push({ fit, emp, j });
    }
  }
  ranked.sort((a, b) => b.fit - a.fit);
  return {
    jobs: ranked.slice(0, max).map(({ emp, j }) => ({
      id: `feed-${emp.feed.type}-${Buffer.from(j.url).toString("base64url").slice(-24)}`,
      title: j.title, company: emp.name, city: [j.city, j.state].filter(Boolean).join(", ") || (j.remote ? "Remote" : null),
      lat: null, lng: null, work_mode: j.remote ? "remote" : "onsite", pay_text: j.pay_text || null,
      summary: (j.description || "").slice(0, 300), description: j.description || null, details_url: j.description ? null : j.url,
      url: j.url, employer: emp.name, workplace: emp.group, source: `${emp.name} careers`,
    })),
    status: lists.map(({ emp, jobs, error }) => ({ employer: emp.name, openings: jobs.length, error })),
  };
}

// The full posting for a feed job that came without one (Breezy lists titles only). Job pages carry it in
// the standard schema.org JobPosting block that Google for Jobs reads. Only fetched for jobs being scored.
const details = new Map();
export async function jobDetails(url) {
  if (details.has(url)) return details.get(url);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "ForeSIGHT-JobSeeker (Chart Academy student project)" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const html = await res.text();
    for (const [, block] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const found = [JSON.parse(block)].flat().find((d) => d["@type"] === "JobPosting");
        if (found?.description) {
          const text = strip(strip(found.description));
          details.set(url, text);
          return text;
        }
      } catch { /* not JSON we can read; try the next block */ }
    }
  } catch { /* page unreachable: the job is scored from its title */ }
  details.set(url, null);
  return null;
}
