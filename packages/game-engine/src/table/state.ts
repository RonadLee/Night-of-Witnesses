import type {
  BoilerRole,
  PassRecord,
  RoundSummary,
  TableActivity,
  TableChatMessage,
  TablePhase,
  TableSettings,
  TableWinner,
} from '@now/game-types';

export interface TablePlayer {
  id: string;
  name: string;
  seatIndex: number;
  connected: boolean;
  role: BoilerRole | null;
  hand: BoilerRole[];
  passedCard: BoilerRole | null;
  description: string | null;
  draft: string;
  hasVoted: boolean;
  voteTargetId: string | null;
  canVote: boolean;
  typing: boolean;
}

export interface Ballot {
  voterId: string;
  targetId: string;
  weight: number;
  invalidated: boolean;
}

export interface TableResolution {
  voteTotals: Record<string, number>;
  ballots: Ballot[];
  abilityNotes: string[];
}

export interface TableState {
  seed: number;
  settings: TableSettings;
  hostPlayerId: string;
  phase: TablePhase;
  round: number;
  players: TablePlayer[];
  passOrder: number[];
  passCursor: number;
  descriptionCursor: number;
  currentSeat: number;
  deck: BoilerRole[];
  unseatedCard: BoilerRole | null;
  departedGuests: [BoilerRole, BoilerRole];
  departedPublic: boolean;
  phaseEndsAt: number | null;
  activity: TableActivity[];
  chat: TableChatMessage[];
  passes: PassRecord[];
  winner: TableWinner;
  lockedPlayerId: string | null;
  scores: Record<string, number>;
  revoteCount: number;
  seq: number;
  nonces: Record<string, string>;
  chatTimes: Record<string, number[]>;
  reactionTimes: Record<string, number[]>;
  lastChat: Record<string, { text: string; at: number }>;
  detectiveUsed: boolean;
  previousRounds: RoundSummary[];
  resolution: TableResolution | null;
}

export type TableEffect = 'return_lobby' | 'end_game' | null;

export type TableEngineResult =
  | { ok: true; state: TableState; effect: TableEffect }
  | { ok: false; error: string; state: TableState };

export function cloneTable(state: TableState): TableState {
  return structuredClone(state);
}
