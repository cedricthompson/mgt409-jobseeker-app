// Fairness guard: removes protected traits from a profile before any agent sends it to the model,
// so age, gender, race, religion, disability, and similar facts can never affect matches, scores, or writing.
const PROTECTED = /^(age|birth|dob|date_of_birth|birth_year|gender|sex|pronouns|race|ethnicity|national_origin|nationality|citizenship_country|religion|faith|disability|disabilities|health|medical|pregnan|marital|married|spouse|children|family_status|veteran_disability|sexual_orientation|photo|headshot)/i;

export function jobFacts(profile = {}) {
  if (!profile || typeof profile !== "object") return {};
  return Object.fromEntries(Object.entries(profile).filter(([key]) => !PROTECTED.test(key)));
}
