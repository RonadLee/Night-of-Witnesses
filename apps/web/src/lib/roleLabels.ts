import type { RoleId } from '@now/game-types';

export const ALL_ROLE_IDS: RoleId[] = [
  'murderer',
  'accomplice',
  'bomber',
  'butler',
  'detective',
  'merchant',
  'lawyer',
  'guest_yellow',
  'guest_blue',
  'guest_red',
];

export const ROLE_LABELS: Record<RoleId, string> = {
  murderer: 'Murderer',
  accomplice: 'Accomplice',
  bomber: 'Bomber',
  butler: 'Butler',
  detective: 'Detective',
  merchant: 'Merchant',
  lawyer: 'Lawyer',
  guest_yellow: 'Yellow Guest',
  guest_blue: 'Blue Guest',
  guest_red: 'Red Guest',
};

export const ROLE_LABELS_ZH: Record<RoleId, string> = {
  murderer: '殺人魔',
  accomplice: '共犯',
  bomber: '炸彈客',
  butler: '管家',
  detective: '偵探',
  merchant: '富商',
  lawyer: '律師',
  guest_yellow: '黃色客人',
  guest_blue: '藍色客人',
  guest_red: '紅色客人',
};

export const ROLE_IMAGES: Record<RoleId, string> = {
  murderer: '/roles/murderer.png',
  accomplice: '/roles/accomplice.png',
  bomber: '/roles/bomber.png',
  butler: '/roles/butler.png',
  detective: '/roles/detective.png',
  merchant: '/roles/merchant.png',
  lawyer: '/roles/lawyer.png',
  guest_yellow: '/roles/guest-yellow.png',
  guest_blue: '/roles/guest-blue.png',
  guest_red: '/roles/guest-red.png',
};

export function roleLabel(role: RoleId | null | undefined, locale: 'en' | 'zh-TW' = 'en'): string {
  if (!role) return '—';
  if (locale === 'zh-TW') return ROLE_LABELS_ZH[role] ?? role;
  return ROLE_LABELS[role] ?? role;
}

export function roleLabelZh(role: RoleId | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABELS_ZH[role] ?? role;
}

export function roleImage(role: RoleId): string {
  return ROLE_IMAGES[role] ?? '/roles/guest-yellow.png';
}
