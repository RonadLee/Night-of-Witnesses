import type { RoleId } from '@now/game-types';

export const ROLE_LABELS: Record<RoleId, string> = {
  murderer: 'Murderer',
  accomplice: 'Accomplice',
  doctor: 'Doctor',
  detective: 'Detective',
  spy: 'Spy',
  priest: 'Priest',
  lawyer: 'Lawyer',
  journalist: 'Journalist',
  engineer: 'Engineer',
  psychologist: 'Psychologist',
  merchant: 'Merchant',
};

export function roleLabel(role: RoleId | null | undefined): string {
  if (!role) return 'Unknown';
  return ROLE_LABELS[role] ?? role;
}
