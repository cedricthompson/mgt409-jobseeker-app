// The sample Predictability Scorecard shown on the Scorecard page and, in miniature, on the opening page.
// Numbers come from the app's real rules (server/agents/scorecard.js) for this example applicant:
// fit parts skills 78, credentials 60, experience 100, pay 90, commute 70 -> overall 77; food service, mid level,
// medium competition -> interview 46%, hired 28%, promoted 18%, still there 54% / 44% / 37% at 12 / 18 / 24 months.
export type Color = 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'red';

export const CHANCES: { label: string; value: number; color: Color; icon: string; note: string }[] = [
  { label: 'Get an interview', value: 46, color: 'blue', icon: '📞', note: 'About 1 in 2. Most applicants for this kind of job hear back less often.' },
  { label: 'Get hired', value: 28, color: 'green', icon: '🤝', note: 'Your odds of an offer, counting the interview step.' },
  { label: 'Promoted within a year', value: 18, color: 'orange', icon: '📈', note: 'Kitchen roles promote from within more than most.' },
  { label: 'Still there after 1 year', value: 54, color: 'purple', icon: '📅', note: 'Above average for food service, where about half of new hires stay a year.' },
];

export const STAY = [{ label: '12 months', value: 54 }, { label: '18 months', value: 44 }, { label: '24 months', value: 37 }];

export const FIT: { label: string; icon: string; weight: number; score: number; color: Color; note: string }[] = [
  { label: 'Skills', icon: '🧰', weight: 30, score: 78, color: 'teal', note: 'Grill, prep, and training new hires match the job. Ordering and inventory would be new to you.' },
  { label: 'Credentials', icon: '🎓', weight: 25, score: 60, color: 'purple', note: 'You have ServSafe Food Handler. The job asks for ServSafe Manager.' },
  { label: 'Experience', icon: '⏱️', weight: 15, score: 100, color: 'orange', note: 'You have 3 years. The job asks for 2.' },
  { label: 'Pay', icon: '💵', weight: 15, score: 90, color: 'green', note: 'Pays about $47,500. Your target is $50,000.' },
  { label: 'Commute', icon: '🚌', weight: 15, score: 70, color: 'blue', note: 'About 39 minutes each way by bus. Your limit is 30.' },
];

export const OVERALL = 77;

export const SAMPLE_JOB = { title: 'Kitchen Manager', where: 'Riverside Grill (sample) · Columbus, OH · $47,500 a year', who: 'For Maria: 3 years as a line cook, ServSafe Food Handler, wants to lead a kitchen.' };
