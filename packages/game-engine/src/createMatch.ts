import type { MatchVariant, PlayerSeat } from '@now/game-types';
import { MAX_PLAYERS, MIN_PLAYERS } from '@now/game-types';
import { createRng } from './rng';
import { buildDeck } from './roles';
import { defaultVariant, seatsFromPlayers, type MatchState } from './state';

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
  const rng = createRng(seed);
  const variant = defaultVariant(options.variant);
  const deck = buildDeck(sorted.length, variant, rng);

  const state: MatchState = {
    seed,
    variant,
    phase: 'role_assignment',
    round: 1,
    players: seatsFromPlayers(sorted),
    deck,
    guestRoomCard: null,
    currentSeat: 0,
    phaseEndsAt: null,
    sightings: [],
    abilityReveals: [],
    chat: [],
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
  };

  // Seed player 0 with the first card so they have received + will draw.
  const startCard = state.deck.shift();
  if (!startCard) {
    throw new Error('Deck empty at start');
  }
  state.players[0]!.hand = [startCard];
  dealDrawToCurrent(state);

  return state;
}

/** Draw one card from deck into the current seat's hand (expects 1 card already). */
export function dealDrawToCurrent(state: MatchState): void {
  const player = state.players[state.currentSeat];
  if (!player) {
    throw new Error('Invalid current seat');
  }
  const drawn = state.deck.shift();
  if (!drawn) {
    throw new Error('Deck empty during deal');
  }
  player.hand = [...player.hand, drawn];
}
