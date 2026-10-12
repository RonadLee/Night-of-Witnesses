export const AVATAR_COLORS: Record<string, string> = {
  'avatar-you': '#c45c26',
  'avatar-1': '#3d7a6a',
  'avatar-2': '#6b5b95',
  'avatar-3': '#8b4513',
  'avatar-4': '#2f5d8c',
  'avatar-5': '#7a3b3b',
  'avatar-6': '#4a6741',
  'avatar-7': '#9a7b4f',
  'avatar-8': '#5c6b7a',
};

export function avatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
