import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  SPECIAL_ROLES,
  type PassDirection,
  type SpecialRole,
  type TableSettings,
} from '@now/game-types';

export const PASS_TURN_MS = 45_000;

export const DEFAULT_TABLE_SETTINGS: TableSettings = {
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  deckType: 'boiler',
  customCardSet: false,
  enabledSpecials: [...SPECIAL_ROLES],
  descriptionSeconds: 30,
  discussionSeconds: 120,
  votingSeconds: 10,
  rounds: 1,
  passDirection: 'clockwise',
  specialCards: true,
  allowSpectators: false,
  anonymousVoting: false,
};

const SETTING_KEYS = [
  'minPlayers',
  'maxPlayers',
  'deckType',
  'customCardSet',
  'enabledSpecials',
  'descriptionSeconds',
  'discussionSeconds',
  'votingSeconds',
  'rounds',
  'passDirection',
  'specialCards',
  'allowSpectators',
  'anonymousVoting',
] as const;

function intIn(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function flag(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function direction(value: unknown, fallback: PassDirection): PassDirection {
  if (value === 'clockwise' || value === 'counter-clockwise' || value === 'random') return value;
  return fallback;
}

function specials(value: unknown, fallback: SpecialRole[]): SpecialRole[] {
  if (!Array.isArray(value)) return [...fallback];
  const allowed = new Set<string>(SPECIAL_ROLES);
  const next: SpecialRole[] = [];
  for (const item of value) {
    if (typeof item === 'string' && allowed.has(item) && !next.includes(item as SpecialRole)) {
      next.push(item as SpecialRole);
    }
  }
  return next;
}

export function sanitizeSettings(input: unknown, base: TableSettings = DEFAULT_TABLE_SETTINGS): TableSettings {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const picked: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    if (key in src) picked[key] = src[key];
  }
  const maxPlayers = intIn(picked.maxPlayers, base.maxPlayers, MIN_PLAYERS, MAX_PLAYERS);
  const enabled = specials(picked.enabledSpecials, base.enabledSpecials);
  return {
    minPlayers: MIN_PLAYERS,
    maxPlayers,
    deckType: picked.deckType === 'classic' || picked.deckType === 'boiler' ? picked.deckType : base.deckType,
    customCardSet: flag(picked.customCardSet, base.customCardSet),
    enabledSpecials: enabled,
    descriptionSeconds: intIn(picked.descriptionSeconds, base.descriptionSeconds, 10, 180),
    discussionSeconds: intIn(picked.discussionSeconds, base.discussionSeconds, 30, 600),
    votingSeconds: intIn(picked.votingSeconds, base.votingSeconds, 5, 120),
    rounds: intIn(picked.rounds, base.rounds, 1, 5),
    passDirection: direction(picked.passDirection, base.passDirection),
    specialCards: flag(picked.specialCards, base.specialCards),
    allowSpectators: flag(picked.allowSpectators, base.allowSpectators),
    anonymousVoting: flag(picked.anonymousVoting, base.anonymousVoting),
  };
}

export function mergeSettings(current: TableSettings, patch: unknown): TableSettings {
  const src = patch && typeof patch === 'object' ? (patch as Record<string, unknown>) : {};
  const overlay: Record<string, unknown> = { ...current };
  for (const key of SETTING_KEYS) {
    if (key in src) overlay[key] = src[key];
  }
  return sanitizeSettings(overlay);
}
