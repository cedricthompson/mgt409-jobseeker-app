# Where we left off (November 13, 2026)

The MGT 409 final project is due **November 23, 2026**.

## Where everything lives

| What | Where |
|---|---|
| Main copy (code, report, history) | GitHub: `cedricthompson/mgt409-jobseeker-app`, branch `main` |
| Working copy with the API keys (`.env`) | This Mac: `~/Developer/mgt409-jobseeker-app` |
| Snapshot (no keys) | OneDrive: `Projects/MGT409-JobSeeker-App-latest` (see `SNAPSHOT.txt` for the commit) |
| Live app | https://chart-academy-career-coach.onrender.com (`/api/health` shows the running version) |
| Final report | [`report/report.html`](report/report.html) (open in Chrome; File → Print → Save as PDF to submit). A printed preview is in OneDrive as `report/ForeSIGHT-report-preview.pdf`. |

## Done

- **Report:** all 8 sections plus References, with the design pass (cover logo, coach portraits, boxed steps, before/after
  cost table, risk-ordered safety table, attack flow chart), The Chart Academy's 2024 results and the 20–30 city
  scale and staffing-savings scenarios (Section 7), and Section 8's challenges in the "what we already do + next step" format.
- **App:** only jobs with at least a 50% chance of an interview and of an offer; Theo asks what jobs and workplaces each
  job seeker wants; faster matching; JSearch Pro plan read automatically (10,000 searches a month); steady scores (each
  job is read once and reused); ForeSIGHT name and logo on every screen; new opening screen.
- **Security:** red-team protocol and log (12 of 15 attacks stopped before, 20 of 20 after), three levels of defense,
  coach rules in `prompts/prompt.md`, four booby traps. See `security/README.md`. `security/LESSONS.md` and
  `prompts/prompt.md` are add-only.

## Still to do

1. **Read sections 6–8 of the report** for voice; they were drafted for you.
2. **Two one-pagers** you asked for: an invention summary for a patent/IP consult, and a checklist of each data source's
   commercial-use terms (JSearch, Adzuna, USAJobs, O\*NET, the course model key).
3. **Render settings:** check the service's Instance Type (Settings → Instance Type) and update `render.yaml`, which
   still says `plan: free`. To read the security log and the usage stats page (`/stats`), add `SECURITY_ADMIN_TOKEN` there (a long random password).
4. **Small app fix:** when no jobs qualify, the matches page still says "The employers below are hiring…" but that list
   was removed.
5. **Optional:** rerun `node server/eval/trace.js` so `evidence/trace.md` reflects the new matcher (uses model calls).

## Careful

- **Don't test the booby traps on the live site** (for example `/.env` or `/api/admin/export`): they block your own
  internet address for 24 hours. Test them with `node server/eval/redteam.js`, which uses its own test server.
- The repo is public, so the bait *paths* are visible; the trap *values* are secret.
