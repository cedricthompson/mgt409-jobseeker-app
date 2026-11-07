// Agent 5: Application Coach.
// Writes application materials for one job from the applicant's real profile:
// a tailored resume, a cover letter, a follow-up email, or interview prep.
import { chat } from "../llm.js";
import { SAFETY, accessibility } from "./common.js";

const TASKS = {
  resume: "Write a one-page resume tailored to this job. Order and word the applicant's real experience to match the job. Use plain text with simple section headings (SUMMARY, SKILLS, EXPERIENCE, CERTIFICATIONS, EDUCATION) and short bullet lines starting with a hyphen. Turn duties into results where the profile supports it.",
  cover_letter: "Write a cover letter under 250 words for this job. Warm, confident, specific to the employer and role. Connect two or three real strengths to the job's needs.",
  follow_up: "Write a short, polite follow-up email (under 120 words) checking on the application status. Include a subject line as the first line, starting with 'Subject:'.",
  interview_prep: "Write interview prep for this job: the 5 questions they are most likely to ask, and for each a short answer outline using the applicant's real experience (situation, action, result). End with 3 smart questions the applicant can ask.",
};

const SYSTEM = `You are the Application Coach agent of a job search app.
${SAFETY}
- Use only facts in the applicant profile. Where a detail is needed but unknown (a number, a date, a name), write a placeholder in square brackets like [number of tickets per week] for the applicant to fill in.
- Never include protected traits, photos, age, or graduation years that reveal age.
Reply ONLY with JSON: {"title": string, "content": string, "tips": [string]}
"content" is plain text ready to copy, with line breaks. "tips" is 2-3 short suggestions for improving it before sending.`;

export async function coach({ task, profile = {}, job = {}, tracked = {}, session, prefs }) {
  if (!TASKS[task]) throw new Error(`Unknown coach task: ${task}`);
  const jobInfo = { title: job.title, company: job.company, city: job.city, summary: job.summary, skills: job.skills,
    required_certs: job.required_certs, clearance: job.clearance };
  const { text } = await chat(
    [
      { role: "system", content: `${SYSTEM}\n${accessibility(prefs)}` },
      { role: "user", content: `${TASKS[task]}\nApplicant: ${JSON.stringify(profile)}\nJob: ${JSON.stringify(jobInfo)}` +
        (tracked.appliedAt ? `\nApplied on: ${tracked.appliedAt}. Notes: ${tracked.notes || "none"}` : "") },
    ],
    { json: true, agent: `coach:${task}`, session }
  );
  return JSON.parse(text);
}
