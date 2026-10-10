export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 9;

export type RoleId =
  | 'murderer'
  | 'accomplice'
  | 'doctor'
  | 'detective'
  | 'spy'
  | 'priest'
  | 'lawyer'
  | 'journalist'
  | 'engineer'
  | 'psychologist'
  | 'merchant';

export type Team = 'murderer' | 'witness';

export type Phase =
  | 'lobby'
  | 'role_assignment'
  | 'information'
  | 'discussion'
  | 'voting'
  | 'result';

export type SpeechMode = 'voice-or-text' | 'gestures-only';

export interface MatchVariant {
  discussionSeconds: 300 | 120;
  speech: SpeechMode;
  murdererCount: 1 | 2;
  rounds: 1 | 3;
}

export const DEFAULT_VARIANT: MatchVariant = {
  discussionSeconds: 300,
  speech: 'voice-or-text',
  murdererCount: 1,
  rounds: 1,
};

export interface PlayerSeat {
  id: string;
  name: string;
  isBot: boolean;
  seatIndex: number;
}

export interface Sighting {
  fromPlayerId: string;
  claimedRole: RoleId;
  claimedThroughPlayerId: string;
  isPublic: true;
}

export type Action =
  | { type: 'keep_card'; keepIndex: 0 | 1 }
  | { type: 'announce_sighting'; claimedRole: RoleId; claimedThroughPlayerId: string }
  | { type: 'use_doctor'; targetPlayerId: string }
  | { type: 'use_detective'; targetPlayerId: string }
  | { type: 'use_spy' }
  | { type: 'use_priest'; targetPlayerId: string }
  | { type: 'skip_ability' }
  | { type: 'chat'; text: string }
  | { type: 'gesture'; gestureId: string }
  | { type: 'end_discussion' }
  | { type: 'cast_vote'; targetPlayerId: string };

export type WinnerSide = 'witnesses' | 'murderers' | null;

export interface PublicPlayerView {
  id: string;
  name: string;
  isBot: boolean;
  seatIndex: number;
  hasVoted: boolean;
  isSilenced: boolean;
  isLocked: boolean;
}

export interface AbilityReveal {
  kind: 'doctor' | 'detective' | 'spy' | 'priest';
  actorPlayerId: string;
  targetPlayerId?: string;
  summary: string;
  privateTo?: string;
}

export interface MatchPublicView {
  phase: Phase;
  round: number;
  maxRounds: number;
  players: PublicPlayerView[];
  currentPlayerId: string | null;
  phaseEndsAt: number | null;
  sightings: Sighting[];
  abilityReveals: AbilityReveal[];
  chat: Array<{ fromPlayerId: string; text: string; at: number }>;
  winnerSide: WinnerSide;
  lockedPlayerId: string | null;
  scores: Record<string, number>;
  variant: MatchVariant;
  guestRoomPeeked: boolean;
}

export interface MatchPrivateView {
  role: RoleId | null;
  hand: RoleId[];
  myVote: string | null;
  guestRoomCard: RoleId | null;
  doctorResult: { targetPlayerId: string; isMurderer: boolean } | null;
  detectiveReveal: { targetPlayerId: string; passedCard: RoleId } | null;
  legalActions: Action['type'][];
}

export interface PlayerMatchView {
  public: MatchPublicView;
  private: MatchPrivateView;
}
