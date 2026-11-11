// The four ways to start: shown as choices on the opening page, and as the focused step on the import screen.
// LinkedIn doesn't let apps read a profile from its link, so the LinkedIn path uses LinkedIn's own
// "Save to PDF" and then the same PDF upload as a resume.
export type StartMethod = 'resume' | 'linkedin' | 'photo' | 'speak';

export const START_METHODS: { key: StartMethod; icon: string; title: string; hint: string }[] = [
  { key: 'resume', icon: '📄', title: 'Upload your resume', hint: 'A PDF from your computer or phone.' },
  { key: 'linkedin', icon: '🔗', title: 'Use your LinkedIn', hint: 'Save your profile as a PDF in two clicks, then upload it.' },
  { key: 'photo', icon: '📷', title: 'Snap a photo', hint: 'Take a picture of a printed resume.' },
  { key: 'speak', icon: '🎤', title: 'Tell us out loud', hint: 'No resume? Just talk about your work and goals.' },
];

export const LINKEDIN_STEPS = [
  'Open LinkedIn and go to your profile (tap your photo, then View profile).',
  'Choose Resources (or More), then Save to PDF. LinkedIn downloads your profile.',
  'Come back here and tap Upload LinkedIn PDF.',
];

export const SPEAK_PROMPTS = [
  'Where you live and how far you can travel to work',
  'Jobs you have had, for how long, and what you did',
  'School, training, certifications, and licenses',
  'The kind of job and pay you want next',
];
