import type {
  AbilityReveal,
  Action,
  ActivityEvent,
  AiDifficulty,
  AiPersonality,
  MatchVariant,
  Phase,
  PlayerSeat,
  RoleId,
  Sighting,
  WinnerSide,
} from '@now/game-types';
import { DEFAULT_VARIANT } from '@now/game-types';
import type { AiMind } from './ai/mind';

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
  avatarId: string;
  personality: AiPersonality | null;
  difficulty: AiDifficulty | null;
  status: string;
  currentAction: string | null;
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
  activity: ActivityEvent[];
  passHistory: Array<{
    fromPlayerId: string;
    toPlayerId: string | 'guest_room';
    role: RoleId;
    reason?: string;
  }>;
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
  aiMinds: Record<string, AiMind>;
  aiReasoning: Array<{ playerId: string; summary: string }>;
  nextBotActAt: number | null;
  eventSeq: number;
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
    avatarId: p.avatarId ?? (p.isBot ? 'avatar-1' : 'avatar-you'),
    personality: p.personality ?? null,
    difficulty: p.difficulty ?? null,
    status: 'Waiting',
    currentAction: null,
  }));
}

export function defaultVariant(partial?: Partial<MatchVariant>): MatchVariant {
  return { ...DEFAULT_VARIANT, ...partial };
}

export function pushActivity(
  state: MatchState,
  kind: ActivityEvent['kind'],
  message: string,
  actorPlayerId?: string,
  at = Date.now(),
): void {
  state.eventSeq += 1;
  state.activity.push({
    id: `evt-${state.eventSeq}`,
    at,
    kind,
    actorPlayerId,
    message,
  });
  if (state.activity.length > 80) {
    state.activity = state.activity.slice(-80);
  }
}

export type { Action };
