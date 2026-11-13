# What attacking ForeSIGHT taught us

**This file is only ever added to.** Nothing here is deleted or rewritten, even when a defense is later replaced:
the history of what went wrong is the reason each rule exists. Add new lessons at the bottom with the date.

## 2026-11-08: First safety tests (5 of 8 passed)

1. **Bias came from the model, not the code.** Adding age, gender, religion, and disability to an identical profile dropped
   the chance of being hired from 55% to 38%. Fix: a fairness filter removes protected traits before any coach sees a
   profile. After: 68% and 68%.
2. **A blocked attack can still look like a crash.** The provider blocked a jailbreak, but the job seeker saw a raw
   error. Fix: the coach replies kindly and keeps the profile.
3. **Tests need testing.** The rate-limit test failed because it ran before the test server was ready. Fix: wait for
   the server and check every response.

## 2026-11-13: Red team, an attacker posing as a job seeker (12 of 15 stopped before, 20 of 20 after)

4. **The coaches held; the platform leaked.** All ten attacks on the five coaches were refused by the model. The three
   that got through were plain code problems. Lesson: test the platform as hard as the prompts.
5. **Never trust a header the visitor can write.** The hourly limit used the first `X-Forwarded-For` address. With a new
   fake address on each request, 45 of 45 requests got through (P3). Fix: identify visitors by Cloudflare's
   `CF-Connecting-IP`, which visitors cannot set (checked on the live site: Cloudflare rejects it with error 1000).
6. **Public stats can be a leak.** `/api/usage` listed every visitor's session id, so anyone could see who else was using
   the app (P1). Fix: totals only.
7. **"Account already exists" tells an attacker who your users are.** Sign-up confirmed the victim's account (P2). Fix:
   5 sign-ups and 10 sign-ins per visitor per hour, and probing is logged.
8. **A model refusing is not a design.** A fake "SYSTEM UPDATE FROM FORESIGHT ADMIN" in the browser-sent match summary
   reached the model as a *system* message (A5). The model ignored it, but the design trusted it. Fix: everything the
   browser sends is fenced as data in a user-role message, and only known profile fields can come back.
9. **Check the model's claims in code.** A poisoned job posting told the scorer to mark every requirement as met (A7).
   The model resisted, but nothing stopped it if it hadn't. Fix: a requirement counts as met only when its evidence
   matches words in the applicant's profile. On 7 real jobs this downgraded 0 honest requirements.
10. **Scores vary more than we thought.** While checking that the defenses didn't lower scores, the same applicant and job
    scored as low as 43% and as high as 66% for an interview on different runs, with or without the new rules. The
    defenses didn't cause it; the model's requirement judgments vary from run to run.
11. **Traps must not leak themselves.** The safety test printed the start of the bait `.env` (with the fake key) into
    a public evidence file, which would let an attacker recognize the trap. Fix: tests never print bait contents, and
    the secret values come from a server secret, never the repo.
12. **An attacker trips more than one wire.** In the red-team run, the attacker who tried `../` paths to reach the
    accounts file sprang the bait trap and was blocked for every later request. Each trap backs up the others.
