import type { MatchVariant, PlayerSeat } from '@now/game-types';
import { MAX_PLAYERS, MIN_PLAYERS } from '@now/game-types';
import { createMind } from './ai/mind';
import { createRng } from './rng';
import { buildDeck } from './roles';
import { defaultVariant, pushActivity, seatsFromPlayers, type MatchState } from './state';

export interface CreateMatchOptions {
  players: PlayerSeat[];
  seed?: number;
  variant?: Partial<MatchVariant>;
  now?: number;
}

export function createMatch(options: CreateMatchOptions): MatchState {
  const { players } = options;
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`Need ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
  }

  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]!.seatIndex !== i) {
      throw new Error('Seat indices must be contiguous from 0');
    }
  }

  const seed = options.seed ?? Date.now();
  const now = options.now ?? Date.now();
  const rng = createRng(seed);
  const variant = defaultVariant(options.variant);
  if (variant.deckType === 'double_murderer') {
    variant.murdererCount = 2;
  }
  const deck = buildDeck(sorted.length, variant, rng);
  const internal = seatsFromPlayers(sorted);
  const ids = internal.map((p) => p.id);

  const aiMinds: MatchState['aiMinds'] = {};
  for (const p of internal) {
    if (p.isBot && p.personality && p.difficulty) {
      aiMinds[p.id] = createMind(p.id, p.personality, p.difficulty, ids);
    }
  }

  const startSeat =
    variant.passDirection === 'counterclockwise' ? sorted.length - 1 : 0;

  const state: MatchState = {
    seed,
    variant,
    phase: 'role_assignment',
    round: 1,
    players: internal,
    deck,
    guestRoomCard: null,
    currentSeat: startSeat,
    phaseEndsAt: null,
    sightings: [],
    abilityReveals: [],
    chat: [],
    activity: [],
    passHistory: [],
    winnerSide: null,
    lockedPlayerId: null,
    scores: Object.fromEntries(sorted.map((p) => [p.id, 0])),
    revoteCount: 0,
    votes: {},
    doctorResults: {},
    detectiveReveals: {},
    spyPeeks: {},
    guestRoomPeeked: false,
    pendingPassToGuest: null,
    aiMinds,
    aiReasoning: [],
    nextBotActAt: now + 400,
    eventSeq: 0,
  };

  const startCard = state.deck.shift();
  if (!startCard) throw new Error('Deck empty at start');
  state.players[startSeat]!.hand = [startCard];
  state.players[startSeat]!.status = 'Selecting card';
  state.players[startSeat]!.currentAction = 'Choosing which card to keep';
  dealDrawToCurrent(state);
  pushActivity(state, 'phase', 'Role assignment began. Pass the cards.', undefined, now);

  return state;
}

export function dealDrawToCurrent(state: MatchState): void {
  const player = state.players[state.currentSeat];
  if (!player) throw new Error('Invalid current seat');
  const drawn = state.deck.shift();
  if (!drawn) throw new Error('Deck empty during deal');
  player.hand = [...player.hand, drawn];
}

export function nextSeatIndex(state: MatchState, from: number): number {
  const n = state.players.length;
  if (state.variant.passDirection === 'counterclockwise') {
    return (from - 1 + n) % n;
  }
  return (from + 1) % n;
}

export function seatsRemainingInPass(state: MatchState): boolean {
  // Have all seats kept a role?
  return state.players.some((p) => p.role === null);
}
