// Resume import, part of the Intake agent. One model call turns pasted text
// (including a LinkedIn profile or dictated speech), a PDF, or a photo of a
// resume straight into a profile.
// Speech is turned into text on the device (iOS, Android, or browser dictation), so it costs no tokens.
import { chat } from "../llm.js";
import { PROFILE_SHAPE, SAFETY, accessibility } from "./common.js";

const SYSTEM = `You read resumes and LinkedIn profiles for a job search app and extract a structured profile.
${SAFETY}
Reply ONLY with JSON: {"profile": ${PROFILE_SHAPE}, "summary": string, "missing": [string]}
Use null for unknown fields. "summary" is 1-2 sentences confirming what you found. "missing" lists important fields to ask about next.`;

export async function importResume({ kind, data, session, prefs }) {
  let part;
  if (kind === "text") part = { type: "text", text: `Resume text:\n${data}` };
  else if (kind === "image") part = { type: "image_url", image_url: { url: `data:image/jpeg;base64,${data}` } };
  else if (kind === "pdf") part = { type: "file", file: { filename: "resume.pdf", file_data: `data:application/pdf;base64,${data}` } };
  else throw new Error(`Unsupported import kind: ${kind}. Use text, image, or pdf.`);

  const { text } = await chat(
    [
      { role: "system", content: `${SYSTEM}\n${accessibility(prefs)}` },
      { role: "user", content: [{ type: "text", text: "Extract my profile from this." }, part] },
    ],
    { json: true, agent: "import", session }
  );
  return JSON.parse(text);
}
