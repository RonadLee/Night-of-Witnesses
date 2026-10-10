import type {
  AbilityReveal,
  Action,
  MatchVariant,
  Phase,
  PlayerSeat,
  RoleId,
  Sighting,
  WinnerSide,
} from '@now/game-types';
import { DEFAULT_VARIANT } from '@now/game-types';

export interface InternalPlayer {
  id: string;
  name: string;
  isBot: boolean;
  seatIndex: number;
  role: RoleId | null;
  hand: RoleId[];
  passedCard: RoleId | null;
  hasVoted: boolean;
  voteTargetId: string | null;
  isSilenced: boolean;
  isLocked: boolean;
  hasAnnounced: boolean;
  abilityUsed: boolean;
}

export interface MatchState {
  seed: number;
  variant: MatchVariant;
  phase: Phase;
  round: number;
  players: InternalPlayer[];
  deck: RoleId[];
  guestRoomCard: RoleId | null;
  currentSeat: number;
  phaseEndsAt: number | null;
  sightings: Sighting[];
  abilityReveals: AbilityReveal[];
  chat: Array<{ fromPlayerId: string; text: string; at: number }>;
  winnerSide: WinnerSide;
  lockedPlayerId: string | null;
  scores: Record<string, number>;
  revoteCount: number;
  votes: Record<string, string>;
  doctorResults: Record<string, { targetPlayerId: string; isMurderer: boolean }>;
  detectiveReveals: Record<string, { targetPlayerId: string; passedCard: RoleId }>;
  spyPeeks: Record<string, RoleId>;
  guestRoomPeeked: boolean;
  pendingPassToGuest: RoleId | null;
}

export type EngineResult =
  | { ok: true; state: MatchState }
  | { ok: false; error: string; state: MatchState };

export function cloneState(state: MatchState): MatchState {
  return structuredClone(state);
}

export function seatsFromPlayers(players: PlayerSeat[]): InternalPlayer[] {
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    seatIndex: p.seatIndex,
    role: null,
    hand: [],
    passedCard: null,
    hasVoted: false,
    voteTargetId: null,
    isSilenced: false,
    isLocked: false,
    hasAnnounced: false,
    abilityUsed: false,
  }));
}

export function defaultVariant(partial?: Partial<MatchVariant>): MatchVariant {
  return { ...DEFAULT_VARIANT, ...partial };
}

export type { Action };
