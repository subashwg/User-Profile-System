export const ROLE_PRESETS = [
  'Content Creator',
  'Teacher',
  'Entrepreneur',
  'Developer',
  'QA Engineer',
  'Designer',
  'Writer',
  'Consultant',
  'Coach',
  'Other',
] as const;

export type RolePreset = (typeof ROLE_PRESETS)[number];
