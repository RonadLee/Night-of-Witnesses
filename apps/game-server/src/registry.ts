import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const live = new Set<string>();

export function claimCode(code: string): boolean {
  const key = code.toUpperCase();
  if (live.has(key)) return false;
  live.add(key);
  return true;
}

export function releaseCode(code: string) {
  live.delete(code.toUpperCase());
}

export function isLive(code: string): boolean {
  return live.has(code.toUpperCase());
}

export function makeCode(): string {
  const bytes = randomBytes(6);
  let code = '';
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}
