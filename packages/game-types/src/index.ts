export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 9;

/** Official Night of Witnesses roles (shared Solo + Multiplayer). */
export type RoleId =
  | 'murderer'
  | 'accomplice'
  | 'bomber'
  | 'butler'
  | 'detective'
  | 'merchant'
  | 'lawyer'
  | 'guest_yellow'
  | 'guest_blue'
  | 'guest_red';

/** Faction for coarse AI alignment (Bomber is solo). */
export type Team = 'murderer_side' | 'guest_side' | 'bomber' | 'neutral';

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

/** One public/private pass record (actual role may be hidden until result). */
export interface PassRecord {
  fromPlayerId: string;
  toPlayerId: string | 'guest_room';
  /** True identity of the card that moved — null in public views until result. */
  actualRole: RoleId | null;
  /** What the passer announced to the table (may be a bluff). */
  claimedRole: RoleId;
  reason?: string;
}

export type Action =
  | {
      type: 'keep_card';
      keepIndex: 0 | 1;
      /** Role claimed to the recipient / table (defaults to actual passed card if omitted). */
      claimedRole?: RoleId;
      passReason?: string;
    }
  | { type: 'announce_sighting'; claimedRole: RoleId; claimedThroughPlayerId: string; text?: string }
  | { type: 'use_butler'; targetA: string; targetB: string }
  | { type: 'use_detective'; targetPlayerId: string }
  | { type: 'use_lawyer'; targetPlayerId: string }
  | { type: 'skip_ability' }
  | { type: 'chat'; text: string }
  | { type: 'gesture'; gestureId: string }
  | { type: 'end_discussion' }
  | { type: 'cast_vote'; targetPlayerId: string };

export type WinnerSide = 'murderer_side' | 'guest_side' | 'bomber' | 'none' | null;

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
  /** Public claim shown in the feed (pass events). */
  claimedRole?: RoleId;
  toPlayerId?: string | 'guest_room';
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
  tickets: number;
  roleRevealed: boolean;
}

export interface AbilityReveal {
  kind: 'butler' | 'detective' | 'lawyer' | 'merchant' | 'system';
  actorPlayerId: string;
  targetPlayerId?: string;
  summary: string;
  privateTo?: string;
}

export interface TicketBreakdown {
  playerId: string;
  baseTickets: number;
  merchantBonus: number;
  lawyerPenalty: number;
  finalTickets: number;
  butlerWhitened: boolean;
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
  passHistory: PassRecord[];
  /** Latest pass for flying-card animation (claimed image only). */
  lastPassAnimation: {
    fromPlayerId: string;
    toPlayerId: string | 'guest_room';
    claimedRole: RoleId;
    at: number;
  } | null;
  voteTallies: Record<string, number> | null;
  winnerSide: WinnerSide;
  /** Player sent to 爆鎖室 / Private Room */
  privateRoomPlayerId: string | null;
  lockedPlayerId: string | null;
  revealedRoles: Record<string, RoleId> | null;
  scores: Record<string, number>;
  ticketBreakdown: TicketBreakdown[] | null;
  variant: MatchVariant;
  guestRoomPeeked: boolean;
  aiReasoning: Array<{ playerId: string; summary: string }>;
  winningRoleIds: RoleId[];
}

export interface MatchPrivateView {
  role: RoleId | null;
  hand: RoleId[];
  myVote: string | null;
  guestRoomCard: RoleId | null;
  /** Butler-only: secretly viewed guest roles */
  butlerPeek: Array<{ playerId: string; role: RoleId }> | null;
  detectiveNote: string | null;
  legalActions: Action['type'][];
  suspicion: Record<string, number>;
  tickets: number;
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

/** Multiplayer Boiler Room table types (see also `@now/game-types/table`). */
export type {
  BoilerRole,
  SpecialRole,
  TableAction,
  TableDeckType,
  TablePassDirection,
  TablePlayerView,
  TableSettings,
} from './table';
export { CARD_CATALOG, SPECIAL_ROLES } from './table';
