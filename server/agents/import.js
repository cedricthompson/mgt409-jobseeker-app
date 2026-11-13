// Resume import, part of the Intake agent. One model call turns pasted text
// (including a LinkedIn profile or dictated speech), a PDF, or a photo of a
// resume straight into a profile.
// Speech is turned into text on the device (iOS, Android, or browser dictation), so it costs no tokens.
import { chat } from "../llm.js";
import { PROFILE_SHAPE, SAFETY, accessibility, rulesFor, keepKnown } from "./common.js";

const SYSTEM = `You read resumes and LinkedIn profiles for a job search app and extract a structured profile.
${rulesFor("maya")}
Reply ONLY with JSON: {"profile": ${PROFILE_SHAPE}, "summary": string, "missing": [string]}
Capture everything the resume states so the applicant is never asked for it again: every job with all duties and accomplishments (keep numbers like team size, budgets, and results), tools and software, skills, certifications, degrees, and the city.
If target roles are not stated, infer 1-3 from the most recent titles and career direction. Never guess target pay.
Use null for unknown fields. "summary" is 1-2 sentences confirming what you found. "missing" lists only important fields the resume truly does not answer.`;

// Some pickers (the web file picker in particular) send a full data URL
// ("data:application/pdf;base64,....") instead of bare base64. Accept both.
function splitDataUrl(data = "") {
  const m = /^data:([^;,]+)?(?:;[^,]*)?,/.exec(data);
  return m ? { mime: m[1], b64: data.slice(m[0].length) } : { mime: null, b64: data };
}

const CANT_READ = "We could not read that file. Please upload a PDF of your resume, or paste the text instead.";

export async function importResume({ kind, data, mimeType = "image/jpeg", session, prefs }) {
  let part;
  if (kind === "text") part = { type: "text", text: `Resume text:\n${data}` };
  else if (kind === "image") {
    const { mime, b64 } = splitDataUrl(data);
    part = { type: "image_url", image_url: { url: `data:${mime || mimeType};base64,${b64}` } };
  } else if (kind === "pdf") {
    const { b64 } = splitDataUrl(data);
    // Every PDF has "%PDF" in its first 1,024 bytes (usually at the very start). Catch Word files and others early.
    if (!Buffer.from(b64.slice(0, 1400), "base64").toString("latin1").includes("%PDF")) throw new Error(CANT_READ);
    part = { type: "file", file: { filename: "resume.pdf", file_data: `data:application/pdf;base64,${b64}` } };
  } else throw new Error(`Unsupported import kind: ${kind}. Use text, image, or pdf.`);

  let text;
  try {
    ({ text } = await chat(
      [
        { role: "system", content: `${SYSTEM}\n${accessibility(prefs)}` },
        { role: "user", content: [{ type: "text", text: "Extract my profile from this." }, part] },
      ],
      { json: true, agent: "import", session }
    ));
  } catch (err) {
    if (/invalid_file|invalid_image|badly formatted|corrupted/i.test(err.message)) throw new Error(CANT_READ);
    throw err;
  }
  const out = JSON.parse(text);
  return { ...out, profile: keepKnown(out.profile) }; // only known profile fields (design defense)
}
