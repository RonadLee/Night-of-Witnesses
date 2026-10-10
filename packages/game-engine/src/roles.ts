import type { MatchVariant, RoleId, Team } from '@now/game-types';
import { MAX_PLAYERS, MIN_PLAYERS } from '@now/game-types';
import { shuffleInPlace } from './rng';

export const V1_WITNESS_ROLES: RoleId[] = ['doctor', 'detective', 'spy', 'priest'];

export function teamOf(role: RoleId): Team {
  return role === 'murderer' || role === 'accomplice' ? 'murderer' : 'witness';
}

export function buildDeck(playerCount: number, variant: MatchVariant, rng: () => number): RoleId[] {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`Player count must be ${MIN_PLAYERS}-${MAX_PLAYERS}`);
  }

  const deck: RoleId[] = [];
  const murderers = variant.murdererCount;
  for (let i = 0; i < murderers; i++) {
    deck.push('murderer');
  }

  const useAccomplice = murderers === 1 && playerCount >= 6;
  if (useAccomplice) {
    deck.push('accomplice');
  }

  // playerCount seated roles + 1 guest leftover
  const needed = playerCount + 1;
  let witnessSlots = needed - deck.length;
  let wi = 0;
  while (witnessSlots > 0) {
    deck.push(V1_WITNESS_ROLES[wi % V1_WITNESS_ROLES.length]!);
    wi++;
    witnessSlots--;
  }

  shuffleInPlace(deck, rng);
  return deck;
}
