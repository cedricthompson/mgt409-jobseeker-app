# Job Seeker App (MGT 409 Final Project)

A multi-agent job search assistant for iOS, Android, and the web. It builds a complete
candidate profile, finds hidden skills, matches jobs, scores each match from 0 to 100
with predicted outcomes, and tracks every application.

**Status:** in development. Due November 23, 2026.

## The five agents

| # | Agent | What it does |
|---|---|---|
| 1 | **Intake / Profile Builder** | Collects location, education, work history, certifications (IT, Security, ServSafe, etc.), and security clearances in a conversation |
| 2 | **Gap Analysis Interviewer** | Reviews the profile, asks follow-up questions to fill gaps, and surfaces underplayed skills that lead to higher pay |
| 3 | **Job Matcher** | Finds and ranks real job openings near the candidate |
| 4 | **Scorecard / Predictor** | Scores each job 0 to 100 on commute, skills, credentials, and pay, and estimates interview, hire, promotion, and 12/18/24-month retention chances, with a reason for every number |
| 5 | **Application Coach** | Writes a tailored resume and cover letter, drafts follow-ups, and coaches the candidate through the tracker |

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
  - [Remotive](https://remotive.com): remote jobs, no key needed.
- **To switch:** leave the optional keys blank to use only the sample data, or fill them in to add live jobs. A source that is missing a key or fails is skipped.
- Indeed and LinkedIn job data are not used: neither offers a public jobs API, and scraping breaks their terms.

## Setup

1. Copy `.env.example` to `.env` and add your `PORTKEY_API_KEY`.
2. Requires Node 21.7 or newer. The server has no dependencies.
3. `cd server && npm run check` confirms the key works.
4. `npm start` runs the API at http://localhost:3001.
5. In a second terminal: `cd app && npm install && npm run web` opens the app in your browser.
   On a phone, run `npm start` and scan the QR code with the Expo Go app.
