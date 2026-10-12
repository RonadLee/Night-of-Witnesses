const EMOJI = new Set(['👍', '👎', '😂', '🔥', '👀', '💀', '❓', '✅']);

export function cleanText(input: unknown, max: number): string {
  if (typeof input !== 'string') return '';
  const stripped = input
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim();
  return [...stripped].slice(0, max).join('');
}

export function cleanName(input: unknown): string {
  const name = cleanText(input, 24);
  return name || 'Guest';
}

export function cleanPlayerId(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  if (!/^p_[a-zA-Z0-9]{6,24}$/.test(input)) return null;
  return input;
}

export function cleanEmoji(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  return EMOJI.has(input) ? input : null;
}

export function cleanRoomCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = input.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return null;
  return code;
}
