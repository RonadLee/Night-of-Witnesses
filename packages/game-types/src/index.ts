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
export type PassDirection = 'clockwise' | 'counterclockwise';
export type DeckType = 'standard' | 'double_murderer' | 'witness_heavy';
export type AiDifficulty = 'easy' | 'normal' | 'hard' | 'expert';
export type AiPersonality =
  | 'aggressive'
  | 'logical'
  | 'quiet'
  | 'suspicious'
  | 'random'
  | 'deceptive';

export type CampaignLeague = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface MatchVariant {
  discussionSeconds: number;
  descriptionSeconds: number;
  votingSeconds: number;
  speech: SpeechMode;
  murdererCount: 1 | 2;
  rounds: number;
  passDirection: PassDirection;
  deckType: DeckType;
  specialCards: boolean;
}

export const DEFAULT_VARIANT: MatchVariant = {
  discussionSeconds: 120,
  descriptionSeconds: 30,
  votingSeconds: 10,
  speech: 'voice-or-text',
  murdererCount: 1,
  rounds: 1,
  passDirection: 'clockwise',
  deckType: 'standard',
  specialCards: true,
};

export interface PlayerSeat {
  id: string;
  name: string;
  isBot: boolean;
  seatIndex: number;
  avatarId?: string;
  personality?: AiPersonality;
  difficulty?: AiDifficulty;
}

export interface Sighting {
  fromPlayerId: string;
  claimedRole: RoleId;
  claimedThroughPlayerId: string;
  isPublic: true;
  text?: string;
}

export type Action =
  | { type: 'keep_card'; keepIndex: 0 | 1; passReason?: string }
  | { type: 'announce_sighting'; claimedRole: RoleId; claimedThroughPlayerId: string; text?: string }
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

export type ActivityKind =
  | 'pass'
  | 'keep'
  | 'sighting'
  | 'ability'
  | 'chat'
  | 'vote'
  | 'phase'
  | 'system';

export interface ActivityEvent {
  id: string;
  at: number;
  kind: ActivityKind;
  actorPlayerId?: string;
  message: string;
}

export interface PublicPlayerView {
  id: string;
  name: string;
  isBot: boolean;
  seatIndex: number;
  hasVoted: boolean;
  isSilenced: boolean;
  isLocked: boolean;
  avatarId: string;
  personality: AiPersonality | null;
  difficulty: AiDifficulty | null;
  status: string;
  currentAction: string | null;
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
  activity: ActivityEvent[];
  passHistory: Array<{
    fromPlayerId: string;
    toPlayerId: string | 'guest_room';
    role: RoleId;
    reason?: string;
  }>;
  voteTallies: Record<string, number> | null;
  winnerSide: WinnerSide;
  lockedPlayerId: string | null;
  revealedRoles: Record<string, RoleId> | null;
  scores: Record<string, number>;
  variant: MatchVariant;
  guestRoomPeeked: boolean;
  aiReasoning: Array<{ playerId: string; summary: string }>;
}

export interface MatchPrivateView {
  role: RoleId | null;
  hand: RoleId[];
  myVote: string | null;
  guestRoomCard: RoleId | null;
  doctorResult: { targetPlayerId: string; isMurderer: boolean } | null;
  detectiveReveal: { targetPlayerId: string; passedCard: RoleId } | null;
  legalActions: Action['type'][];
  suspicion: Record<string, number>;
}

export interface PlayerMatchView {
  public: MatchPublicView;
  private: MatchPrivateView;
}

export interface SoloLobbyConfig {
  aiCount: number;
  difficulty: AiDifficulty;
  deckType: DeckType;
  rounds: number;
  descriptionSeconds: number;
  discussionSeconds: number;
  votingSeconds: number;
  passDirection: PassDirection;
  specialCards: boolean;
  campaignLeague: CampaignLeague | null;
}

export interface SoloStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  correctVotes: number;
  totalVotes: number;
  averageScore: number;
  byDifficulty: Record<AiDifficulty, { played: number; wins: number }>;
  unlockedLeagues: CampaignLeague[];
  unlockedAvatars: string[];
  unlockedThemes: string[];
}
