// The coaching team: one friendly name per AI agent, shared by the opening page and the chat.
// Keys match the agent tags the server returns (intake, gap, matcher, scorecard, coach).
// They are AI assistants, and the app always says so.
import { colors } from './theme';

export type Coach = { key: string; name: string; role: string; line: string; color: string };

export const TEAM: Coach[] = [
  { key: 'intake', name: 'Maya', role: 'Intake Specialist', color: colors.blue,
    line: 'I learn about your work history, schooling, and goals, so you never start from a blank page.' },
  { key: 'gap', name: 'Theo', role: 'Hidden Skills Finder', color: colors.red,
    line: 'I ask a few smart follow-up questions to uncover skills you undersell, the ones that raise your pay.' },
  { key: 'matcher', name: 'Jordan', role: 'Job Matcher', color: colors.blueDark,
    line: 'I search real openings near you, including jobs posted on Indeed and LinkedIn, and pick the best fits.' },
  { key: 'scorecard', name: 'Priya', role: 'Predictability Scorer', color: colors.red,
    line: 'I give every job a 0 to 100 Predictability Score and explain your chances of an interview and an offer.' },
  { key: 'coach', name: 'Marcus', role: 'Application Coach', color: colors.blue,
    line: 'I tailor your resume and cover letter for each job and help you follow up.' },
];

export const coachFor = (key?: string) => TEAM.find((c) => c.key === key);
