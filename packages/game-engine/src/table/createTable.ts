import { CARD_CATALOG, SPECIAL_ROLES, type BoilerRole, type TableSettings } from '@now/game-types';
import { MAX_PLAYERS, MIN_PLAYERS } from '@now/game-types';
import { createRng, shuffleInPlace } from '../rng';
import { PASS_TURN_MS } from './settings';
import type { TablePlayer, TableState } from './state';

export interface TableSeatInput {
  id: string;
  name: string;
  seatIndex: number;
  connected?: boolean;
}

export interface CreateTableOptions {
  players: TableSeatInput[];
  settings: TableSettings;
  hostPlayerId: string;
  seed?: number;
  now?: number;
  scores?: Record<string, number>;
  round?: number;
  previousRounds?: TableState['previousRounds'];
}

const GUESTS: BoilerRole[] = ['guest_red', 'guest_blue', 'guest_yellow'];

export function buildBoilerDeck(
  playerCount: number,
  settings: TableSettings,
  rng: () => number,
): BoilerRole[] {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`Player count must be ${MIN_PLAYERS}-${MAX_PLAYERS}`);
  }
  const size = playerCount + 1;
  const deck: BoilerRole[] = ['murderer'];
  if (settings.specialCards) {
    const enabled = new Set(settings.customCardSet ? settings.enabledSpecials : SPECIAL_ROLES);
    for (const role of SPECIAL_ROLES) {
      if (!enabled.has(role)) continue;
      if (role === 'accomplice' && playerCount < 6) continue;
      // Keep at least one guest card besides the Murderer.
      if (deck.length >= size - 1) break;
      deck.push(role);
    }
  }
  let guest = 0;
  while (deck.length < size) {
    deck.push(GUESTS[guest % GUESTS.length]!);
    guest += 1;
  }
  shuffleInPlace(deck, rng);
  return deck;
}

export function cardLabel(role: BoilerRole): string {
  return CARD_CATALOG[role].name;
}

function passOrderFor(count: number, settings: TableSettings, rng: () => number): number[] {
  const seats = Array.from({ length: count }, (_, i) => i);
  if (settings.passDirection === 'clockwise') return seats;
  if (settings.passDirection === 'counter-clockwise') {
    return [0, ...seats.slice(1).reverse()];
  }
  shuffleInPlace(seats, rng);
  return seats;
}

export function createTableMatch(options: CreateTableOptions): TableState {
  const sorted = [...options.players].sort((a, b) => a.seatIndex - b.seatIndex);
  if (sorted.length < MIN_PLAYERS || sorted.length > MAX_PLAYERS) {
    throw new Error(`Need ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
  }
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]!.seatIndex !== i) throw new Error('Seat indices must be contiguous from 0');
  }
  if (!sorted.some((p) => p.id === options.hostPlayerId)) {
    throw new Error('Host must be seated');
  }

  const seed = options.seed ?? Date.now();
  const rng = createRng(seed);
  const deck = buildBoilerDeck(sorted.length, options.settings, rng);
  const order = passOrderFor(sorted.length, options.settings, rng);
  const departedPool: BoilerRole[] = ['guest_red', 'guest_blue', 'guest_yellow'];
  shuffleInPlace(departedPool, rng);
  const departedGuests: [BoilerRole, BoilerRole] = [departedPool[0]!, departedPool[1]!];

  const players: TablePlayer[] = sorted.map((p) => ({
    id: p.id,
    name: p.name,
    seatIndex: p.seatIndex,
    connected: p.connected !== false,
    role: null,
    hand: [],
    passedCard: null,
    description: null,
    draft: '',
    hasVoted: false,
    voteTargetId: null,
    canVote: true,
    typing: false,
  }));

  const scores: Record<string, number> = {};
  for (const p of players) scores[p.id] = options.scores?.[p.id] ?? 0;

  const firstSeat = order[0]!;
  const first = players.find((p) => p.seatIndex === firstSeat);
  if (!first) throw new Error('Pass order is empty');
  const opening = deck.shift();
  const drawn = deck.shift();
  if (!opening || !drawn) throw new Error('Deck exhausted at deal');
  first.hand = [opening, drawn];

  const now = options.now ?? Date.now();
  const round = options.round ?? 1;
  const state: TableState = {
    seed,
    settings: options.settings,
    hostPlayerId: options.hostPlayerId,
    phase: 'passing',
    round,
    players,
    passOrder: order,
    passCursor: 0,
    descriptionCursor: 0,
    currentSeat: firstSeat,
    deck,
    unseatedCard: null,
    departedGuests,
    departedPublic: false,
    phaseEndsAt: now + PASS_TURN_MS,
    activity: [
      {
        id: 'a1',
        at: now,
        kind: 'phase',
        text: `Round ${round} started. Pass one card when it is your turn.`,
      },
    ],
    chat: [],
    passes: [],
    winner: null,
    lockedPlayerId: null,
    scores,
    revoteCount: 0,
    seq: 1,
    nonces: {},
    chatTimes: {},
    reactionTimes: {},
    lastChat: {},
    detectiveUsed: false,
    previousRounds: options.previousRounds ?? [],
    resolution: null,
  };
  assertTable(state);
  return state;
}

export function assertTable(state: TableState): void {
  const cards: BoilerRole[] = [...state.deck];
  if (state.unseatedCard) cards.push(state.unseatedCard);
  for (const p of state.players) {
    cards.push(...p.hand);
    if (p.role) cards.push(p.role);
  }
  if (cards.length !== state.players.length + 1) {
    throw new Error(`Card count drifted to ${cards.length}`);
  }
  const murderers = cards.filter((c) => c === 'murderer').length;
  if (murderers !== 1) throw new Error('Deck must contain exactly one Murderer');
}
