# ForeSIGHT by Chart Academy (MGT 409 Final Project)

**Let us help you predict your future.** ForeSIGHT is a free AI career coach that finds real job openings near a job
seeker and gives every one a **Predictability Score** from 0 to 100, with their chances of getting an interview, getting
an offer, and still being in the job a year later. People spend their time on the jobs they're likely to land, and skip
the ones that won't call back.

**Live app:** https://chart-academy-career-coach.onrender.com
(free hosting: the first visit after 15 idle minutes takes about 50 seconds to wake up)

Web, iOS, and Android from one codebase (React Native + Expo). The web app is what's hosted.

---

## What a job seeker can do

1. **Start in one of four ways:** upload a resume PDF, use their LinkedIn profile (saved as a PDF), snap a photo of a
   printed resume, or just talk about their work out loud (no resume needed).
2. **Build their profile with the coaches** in a short chat: location, commute, pay, the jobs they want, and skills
   they hadn't thought to mention.
3. **See real jobs near them,** each with a Predictability Scorecard. By default only jobs with at least a 50% chance of
   an interview and a 50% chance of an offer are shown, best chances first; the search widens on its own until it finds some.
4. **Ask "Why this score?"** on any job: the skills they have (with the evidence from their background), the skills to
   build, how each of the five areas adds up to the score, and the single best next step to raise their chances.
5. **Talk with a coach again** from the matches page to change what they're looking for, then get fresh matches.
6. **Check any job they find** elsewhere: paste a link or description (Indeed, LinkedIn, a company site) and get a
   scorecard for that exact job.
7. **Track applications** (Saved → Applied → Screening → Interviewing → Offer), with tailored resumes, cover letters,
   interview prep, and follow-ups from the Application Coach.

## The five coaches (agents)

Each agent is a coach with a name and an illustrated portrait, so job seekers always know who they're talking to.
They're AI assistants, and the app says so.

| Coach | Agent | What it does | Tools and data |
|---|---|---|---|
| **Maya** | Intake Specialist ([`intake.js`](server/agents/intake.js), [`import.js`](server/agents/import.js)) | Reads the resume (PDF, photo, text, or speech) and collects the basics: location, commute, work mode, education, experience, certifications, clearance, target pay | Resume reader (PDF/image), years-of-experience reader that understands date ranges ([`experience.js`](server/experience.js)) |
| **Theo** | Hidden Skills Finder ([`gap.js`](server/agents/gap.js)) | Asks what jobs they want, then up to 3 smart follow-ups that uncover skills people undersell (a shift lead has supervisory experience) | Profile, O\*NET related titles |
| **Jordan** | Job Matcher ([`matcher.js`](server/agents/matcher.js)) | Searches every job source, shortlists the likeliest fits, and widens the search with related titles when too few jobs qualify | Job sources below, O\*NET related titles, sample dataset |
| **Priya** | Predictability Scorer ([`scorecard.js`](server/agents/scorecard.js), [`jobreader.js`](server/agents/jobreader.js)) | Compares each job's requirements with the applicant one by one, scores five areas, and predicts six chances; reads any job link or pasted description for "Check any job" | O\*NET, BLS hiring and turnover patterns, commute estimator / Google Routes ([`geo.js`](server/geo.js)), job page reader |
| **Marcus** | Application Coach ([`coach.js`](server/agents/coach.js)) | Writes a tailored resume and cover letter, interview prep, and follow-ups for a saved job | Profile, job description, tracker notes |

**How they're organized.** An orchestrator ([`orchestrator.js`](server/agents/orchestrator.js)) routes each chat turn with
plain code (no tokens): Maya until the basics are complete, then Theo. Jordan's search starts in the background while Theo
is still asking questions, so matches are often ready when the chat ends. Jordan hands his shortlist to Priya, who scores
each job in parallel. Marcus works from the tracker. From the matches page, the applicant can pick any coach to talk with
again ([`revisit.js`](server/agents/revisit.js)); each one sticks to their own area and changes only what the applicant says.

```
Resume / LinkedIn PDF / photo / speech
        │
        ▼
  Maya (intake) ──► Theo (hidden skills) ──► profile
                                              │   (job search starts in the background)
                                              ▼
                        Jordan (search all sources → shortlist the likeliest fits)
                                              │
                                              ▼
                        Priya (skills check vs. job + O*NET → 5 areas → 6 chances)
                                              │
                                              ▼
              Matches page ── "Why this score?" ── Talk with a coach again ──► new matches
                                              │
                                              ▼
                        Tracker ── Marcus (resume, cover letter, interview prep, follow-ups)
```

**Model:** the course model, `gpt-6-luna`, through Portkey on the course key (`PORTKEY_API_KEY`). No other models are used.
The key stays on the server and never reaches the browser.

## The Predictability Scorecard

**Predictability Score (0 to 100)** adds up five areas. Each area gets its own 0 to 100% score, then counts for part of the total:

| Area | Weight | How it's scored |
|---|---|---|
| Skills | 30% | Each requirement the job needs (from its description, plus core skills from O\*NET for that occupation) is checked against the applicant's background: have it, with evidence, or missing. Listing requirements count twice as much as O\*NET's general ones. |
| Credentials | 25% | Required certifications, licenses, and security clearance |
| Experience | 15% | Years they have vs. years the job asks for |
| Pay | 15% | The job's pay vs. their target |
| Commute | 15% | Door-to-door time by their way of getting to work vs. their limit |

An area the job says nothing about counts as 50%, so missing information neither inflates nor sinks a job. Example: Skills
78% × 30 = 23.4 points; all five add up to the score on the card.

**Six chances**, each on its own 0 to 100% scale: get an interview, get an offer once interviewed, be promoted within a year,
and still be there at 12, 18, and 24 months. They come from **fixed rules in code**, not from the model, so the same applicant
and job always get the same numbers. The starting point for each job family (food service, retail, healthcare, IT, federal,
and more) is typical U.S. hiring and turnover from Bureau of Labor Statistics data (JOLTS, Employee Tenure); the applicant's
fit then raises or lowers their odds. The model only labels the job (family, level, competition) and does the skills check.
Long commutes and below-target pay lower the stay-a-year chances. Every number comes with a reason, and they're estimates,
not guarantees.

## Where the jobs come from

All live sources are optional: a source without a key, or one that fails, is skipped.

| Source | What it adds | Key |
|---|---|---|
| [JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) (Google for Jobs) | Listings posted on LinkedIn, Indeed, Glassdoor, ZipRecruiter, and company sites | `JSEARCH_API_KEY` |
| **Featured employers** ([`employers.json`](server/data/employers.json)) | CACI, Booz Allen Hamilton, Leidos, SAIC, GDIT, Deloitte, Accenture Federal Services, Johns Hopkins, MedStar Health, Children's National, Georgetown, George Washington University, Goodwill, YMCA, United Way, Year Up. Each search picks the ones that hire in the applicant's metro and fit their target roles, with apply links to the employer's own careers site when listed | `JSEARCH_API_KEY` |
| **Employer job feeds** ([`feeds.js`](server/feeds.js)) | Every opening from employers whose hiring system publishes a public feed (Breezy HR, Greenhouse, Lever), starting with Terrestris (140+ openings). The full posting is read for jobs being scored | none |
| [USAJobs](https://developer.usajobs.gov) | Federal jobs, including cleared roles | `USAJOBS_API_KEY`, `USAJOBS_EMAIL` |
| [Adzuna](https://developer.adzuna.com) | Jobs from many boards and company sites | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` |
| [Remotive](https://remotive.com) | Remote jobs | none |
| **Sample dataset** ([`sample-jobs.json`](server/data/sample-jobs.json)) | 32 realistic jobs in Washington DC, Baltimore, Columbus, Denver, and remote (fictional companies marked "(sample)"). Used whenever no live source returns jobs, so the app always works | none |

Indeed and LinkedIn have no public jobs API and don't allow scraping, so their listings come in through Google for Jobs, and
"Check any job" asks for a pasted description when a site blocks apps. Employers' Workday job pages disallow automated
reading, so they aren't read directly.

**Skills data:** [`onet.json`](server/data/onet.json) is a compact copy of the [O\*NET 31.0 Database](https://www.onetcenter.org/database.html):
each of 907 occupations' most important skills, knowledge, and in-demand software, plus 45,000+ job titles mapped to them.

**Commute:** without a key, the app estimates door-to-door time by car, transit (using each metro's system: WMATA, MTA, CTA, and
others), bike, or walking. With `GOOGLE_MAPS_API_KEY`, it uses real routes and transit schedules.

## Keeping cost down

- **Answer cache:** the same agent instructions and input return the saved answer instead of a new model call (24 hours, on disk).
  Scorecard judgments for an applicant and job are saved, so reopening matches costs no tokens.
- **Search caches:** job searches are reused for 1 hour, employer feeds for 6 hours, featured-employer searches for 24 hours.
- **Code before model:** commute, pay, credentials, experience, the five-area score, and all six chances are computed in code.
  Routing between agents is plain code.
- **Small model calls:** the shortlist reads only the 35 best title matches per round (ranked in code), with no hidden reasoning;
  descriptions are cut to the requirements section (about 2,500 characters).
- **JSearch plan sizing:** the server reads the plan's monthly allowance from each reply (shown on `/api/health`), searches more
  on a larger plan, and pauses JSearch before the allowance runs out.
- **Usage tracking:** every model call's tokens are logged per agent and per applicant session (`/api/usage`, `server/logs/tokens.jsonl`).

## Safety

| Risk | Defense |
|---|---|
| Prompt injection in a resume, job posting, or chat | Uploaded and pasted text is treated as data only; agents follow shared safety rules ([`common.js`](server/agents/common.js)); the provider's filter blocks jailbreaks and the app replies kindly without changing the profile |
| Invented facts | Coaches record only what the applicant confirms; the Application Coach never adds degrees or credentials they don't have; chances come from fixed rules, not the model |
| Bias | Protected traits (age, race, gender, religion, disability, marital status...) are never stored or sent to the scoring agents ([`fairness.js`](server/agents/fairness.js)) |
| Overspending | 120 AI requests per visitor per hour; 8 MB upload limit; caches above; JSearch pauses near its monthly allowance |
| Agent malfunction | A failed model call is retried once, then that one job is skipped instead of failing the search; each search request returns after about a minute with what it found |
| Leaked secrets | Keys live only in `.env` / the host's settings (never committed); the web server refuses paths outside the app folder |

**Tested:** [`server/eval/safety.js`](server/eval/safety.js) runs 8 attacks and malfunctions against the real app (prompt
injection in a resume, a jailbreak, protected traits, invented credentials, bias in scores, an oversized upload, the rate
limit, and reading `.env`). Results: [`evidence/safety.md`](evidence/safety.md) (8 of 8 passed).
[`server/eval/trace.js`](server/eval/trace.js) records a traced run of every agent with timing and token counts
([`evidence/trace.md`](evidence/trace.md)).

## Accessibility and comfort

- Light, dark, and high-contrast looks, and three text sizes (every color passes WCAG AA contrast)
- Plain language, one question at a time, read replies aloud, reduce motion
- Coach replies in English, Spanish, Amharic, Chinese, Vietnamese, French, Haitian Creole, Arabic, Korean, or Russian
- Speak any answer with the microphone; screen-reader labels on every button and portrait; 48-point tap targets

## Accounts (optional)

Applicants can create a free account so their profile, settings, and tracker follow them to any device; without one, everything
stays on the device. Passwords are hashed with scrypt, sign-in tokens are stored only as hashes and expire after 60 days,
repeated wrong passwords lock that email for 15 minutes, signing out clears the device (safe on library computers), and
applicants can delete their account and data. Accounts are saved in Postgres when `DATABASE_URL` is set (the live site uses a
free [Neon](https://neon.tech) database), or in `server/data/accounts.local.json` when running locally.

## Run it locally

You need **Node 22 or newer** and **git**. Only `PORTKEY_API_KEY` is required; the other keys add live job sources.

1. Clone the repo and open the folder:
   ```bash
   git clone https://github.com/cedricthompson/mgt409-jobseeker-app.git
   cd mgt409-jobseeker-app
   ```
2. Put your keys in a `.env` file, either in this folder or **one folder up** (the app looks here first, then one level up):
   ```bash
   cp .env.example .env    # then add your PORTKEY_API_KEY
   ```
3. Build the web app (installs everything; about 1–2 minutes):
   ```bash
   npm run build
   ```
4. Start the app and the API together, then open http://localhost:3001:
   ```bash
   npm start
   ```

Optional: `npm run check` confirms the Portkey key works. To work on the app with live reload, run `npm start` in one terminal
and `cd app && npm install && npm run web` in a second; on a phone, run `npx expo start` in `app/` and scan the QR code with Expo Go.

**Sample vs. live jobs:** leave the optional keys blank to use the sample dataset (plus the key-free sources, Remotive and the
employer feeds, when you're online), or fill them in to add live jobs.

## Hosting

The live site is one free [Render](https://render.com) web service ([`render.yaml`](render.yaml)): `npm run build` builds the web
app, and `npm start` serves the app and the API from one server. Keys are entered in the Render dashboard, never committed.
`/api/health` shows the running version, which job sources are on, and the JSearch allowance.

## Project layout

```
app/                    React Native + Expo app (web, iOS, Android)
  screens/              Welcome, Import (4 ways to start), Chat, Matches, Scorecard, Check any job, Tracker, Coach, Settings, Account
  components/           Scorecard pieces, coach portraits and key, "Why this score?", wordmark
  team.ts, theme.ts     The five coaches; colors, looks, and text sizes
server/                 Node API (also serves the built web app)
  agents/               intake, import, gap, matcher, scorecard, jobreader, coach, revisit, orchestrator, fairness
  sources.js, feeds.js  Job sources, featured employers, employer feeds
  onet.js, geo.js       O*NET skills and titles; geocoding and commute estimates
  llm.js, memo.js       Model calls with caching and token tracking; saved scorecard judgments
  eval/                 Safety tests and traced runs (write to evidence/)
  data/                 sample-jobs.json, onet.json, employers.json
evidence/               Safety test results and traced runs for the report
report/report.html      Final project report (one self-contained file; open it by double-clicking)
```

## Final project report

[`report/report.html`](report/report.html) is the MGT 409 final report: one HTML file with every screenshot built in, so it opens
by double-clicking on any computer. All eight sections are drafted: title, motivation, what's new, the agents with a live traced
run, tokenomics, safety (with before-and-after test results), impact, and limits and next steps.

## Credits

- Job skills data: *This product includes information from the O\*NET 31.0 Database by the U.S. Department of Labor, Employment
  and Training Administration (USDOL/ETA), used under the CC BY 4.0 license. USDOL/ETA has not approved, endorsed, or tested
  these modifications.*
- Hiring and turnover patterns: U.S. Bureau of Labor Statistics (JOLTS, Employee Tenure).
- Photos: [Unsplash](https://unsplash.com/license) (see [`app/assets/people/CREDITS.md`](app/assets/people/CREDITS.md)).
- Brand and logo: Chart Academy (see [`STYLE_GUIDE.md`](STYLE_GUIDE.md)).
