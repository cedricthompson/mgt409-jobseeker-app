# Job Seeker App (MGT 409 Final Project)

A multi-agent job search assistant for iOS, Android, and the web. It builds a complete
candidate profile, finds hidden skills, matches jobs, scores each match from 0 to 100
with predicted outcomes, and tracks every application.

**Live app:** https://chart-academy-career-coach.onrender.com (free hosting: the first visit after 15 idle minutes takes about 50 seconds to wake up)

**Status:** in development. Due November 23, 2026.

## The five agents

| # | Agent | What it does |
|---|---|---|
| 1 | **Intake / Profile Builder** | Collects location, education, work history, certifications (IT, Security, ServSafe, etc.), and security clearances in a conversation |
| 2 | **Gap Analysis Interviewer** | Reviews the profile, asks follow-up questions to fill gaps, and surfaces underplayed skills that lead to higher pay |
| 3 | **Job Matcher** | Finds and ranks real job openings near the candidate |
| 4 | **Scorecard / Predictor** | Scores each job 0 to 100 on commute, skills, credentials, and pay, and estimates interview, hire, promotion, and 12/18/24-month retention chances, with a reason for every number. **Check any job:** its Job Reader tool reads a job link (or a pasted description) from any site and predicts the applicant's chances for that exact job |
| 5 | **Application Coach** | Writes a tailored resume and cover letter, drafts follow-ups, and coaches the candidate through the tracker |

**Job sources:** USAJobs, Adzuna, Google Jobs through JSearch (listings posted on LinkedIn, Indeed, Glassdoor, ZipRecruiter, and company sites), and Remotive. LinkedIn and Indeed don't allow apps to read their pages directly, so for a link from those sites the app asks the applicant to paste the description.

**Accounts (optional):** applicants can create a free account (email and password) so their profile, settings, and tracker follow them to any phone or computer. Without one, everything stays on the device. Passwords are hashed with scrypt, sign-in tokens are stored only as hashes and expire after 60 days, repeated wrong passwords lock that email for 15 minutes, signing out clears the device (safe on library computers), and applicants can delete their account and data. Accounts are saved in Postgres when `DATABASE_URL` is set (the live site uses a free [Neon](https://neon.tech) database); when you run the app locally without it, they are saved in `server/data/accounts.local.json`.

The **application tracker** (Saved → Applied → Screening → Interviewing → Offer) is an app
feature that the agents read from and write to.

## Planned stack

- **App:** React Native + Expo (one codebase for iOS, Android, and web)
- **Server:** small Node API that calls the course model (`gpt-6-luna` via Portkey) so the key never reaches the client
- **Data:** O\*NET, BLS (OEWS wages, JOLTS, Employee Tenure), USAJobs / Adzuna job listings, and a maps API for commute times

## Job data

- **Test dataset:** [`server/data/sample-jobs.json`](server/data/sample-jobs.json) has 32 realistic sample jobs in Washington DC (including federal and cleared roles), Columbus OH, Baltimore MD, Denver CO, and remote. Company names are fictional and marked "(sample)". Pay ranges are approximate. The app always works with this data alone.
- **Live sources (optional, in [`server/sources.js`](server/sources.js)):**
  - [USAJobs](https://developer.usajobs.gov): federal jobs with clearance requirements. Set `USAJOBS_API_KEY` and `USAJOBS_EMAIL`.
  - [Adzuna](https://developer.adzuna.com): jobs from many boards and company sites. Set `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
  - [JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) (Google for Jobs): listings posted on LinkedIn, Indeed, Glassdoor, ZipRecruiter, and company sites. Set `JSEARCH_API_KEY` (free plan: about 200 searches a month). Indeed and LinkedIn have no public job search API and don't allow scraping, so this is how their listings come in.
  - **Featured employers** ([`server/data/employers.json`](server/data/employers.json)): CACI, Booz Allen Hamilton, Leidos, SAIC, GDIT, Deloitte, Accenture Federal Services, Johns Hopkins, MedStar Health, Children's National, Georgetown, George Washington University, Goodwill, YMCA, United Way, and Year Up. Searched through Google for Jobs (uses `JSEARCH_API_KEY`), with apply links to the employer's own careers site when listed. Each search picks at most 2 employers that hire in the applicant's metro and fit their target roles, and reuses results for 24 hours to stay inside the free plan. Employers' own Workday job pages disallow automated reading, so they aren't read directly.
  - [Remotive](https://remotive.com): remote jobs, no key needed.
- **Skills matching ([O\*NET](https://www.onetcenter.org/database.html)):** [`server/data/onet.json`](server/data/onet.json) is a compact copy of the O\*NET 31.0 Database: each occupation's most important skills, knowledge, and in-demand software, plus 45,000+ job titles. The Scorecard compares each job's requirements (from its description, plus O\*NET's core skills for the matching occupation) with the applicant's background, one by one. *This product includes information from the O\*NET 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the CC BY 4.0 license. USDOL/ETA has not approved, endorsed, or tested these modifications.*
- **Commute times:** without a key, the app estimates door-to-door time by car, public transit, bike, or walking. With `GOOGLE_MAPS_API_KEY` set, it uses real routes and transit schedules from each agency (WMATA in DC, the MTA in New York, and others).
- **To switch:** leave the optional keys blank to use only the sample data, or fill them in to add live jobs. A source that is missing a key or fails is skipped.
- Indeed and LinkedIn job data are not used: neither offers a public jobs API, and scraping breaks their terms.

## Hosted version

The app is set up to run online as one free [Render](https://render.com) web service (see [`render.yaml`](render.yaml)):
`npm run build` builds the web app, and `npm start` serves both the app and the API.
Keys are entered in the Render dashboard, never committed. Each visitor is limited to 120 AI requests per hour to protect the course key.

## Run it locally

Quick version (one server, like the hosted app): `npm run build && npm start`, then open http://localhost:3001.

## Setup

1. Copy `.env.example` to `.env` and add your `PORTKEY_API_KEY`.
2. Requires Node 21.7 or newer. The server has no dependencies.
3. `cd server && npm run check` confirms the key works.
4. `npm start` runs the API at http://localhost:3001.
5. In a second terminal: `cd app && npm install && npm run web` opens the app in your browser.
   On a phone, run `npm start` and scan the QR code with the Expo Go app.
