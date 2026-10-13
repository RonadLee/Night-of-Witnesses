/** Boiler Room deck used by Multiplayer. Solo keeps the frozen v1 RoleId rules. */

export const SPECIAL_ROLES = [
  'bomber',
  'accomplice',
  'butler',
  'detective',
  'merchant',
  'lawyer',
] as const;

export type SpecialRole = (typeof SPECIAL_ROLES)[number];

export type BoilerRole = 'murderer' | SpecialRole | 'guest_red' | 'guest_blue' | 'guest_yellow';

/** Multiplayer table-only pass directions (distinct from solo MatchVariant). */
export type TablePassDirection = 'clockwise' | 'counter-clockwise' | 'random';

/** Multiplayer table deck modes. */
export type TableDeckType = 'boiler' | 'classic';

export type TablePhase = 'passing' | 'description' | 'discussion' | 'voting' | 'result' | 'ended';

export type TableWinner = 'guests' | 'murderers' | 'bomber' | null;

export interface TableSettings {
  minPlayers: number;
  maxPlayers: number;
  deckType: TableDeckType;
  customCardSet: boolean;
  enabledSpecials: SpecialRole[];
  descriptionSeconds: number;
  discussionSeconds: number;
  votingSeconds: number;
  rounds: number;
  passDirection: TablePassDirection;
  specialCards: boolean;
  allowSpectators: boolean;
  anonymousVoting: boolean;
}

export interface CardCopy {
  id: BoilerRole;
  name: string;
  nameZh: string;
  tint: string;
  image: string;
  summary: string;
  summaryZh: string;
}

export const CARD_CATALOG: Record<BoilerRole, CardCopy> = {
  murderer: {
    id: 'murderer',
    name: 'Murderer',
    nameZh: '殺人魔',
    tint: '#6e2b2b',
    image: '/cards/murderer.png',
    summary: 'Avoid the Boiler Room. You win if you do not enter.',
    summaryZh: '避免進入鍋爐室。若未進入鍋爐室則獲勝。',
  },
  accomplice: {
    id: 'accomplice',
    name: 'Accomplice',
    nameZh: '共犯',
    tint: '#7a3048',
    image: '/cards/accomplice.png',
    summary: "The Murderer's assistant. You win if the Murderer does not enter the Boiler Room.",
    summaryZh: '殺人魔的助手。若殺人魔未進入鍋爐室則獲勝。',
  },
  bomber: {
    id: 'bomber',
    name: 'Bomber',
    nameZh: '炸彈客',
    tint: '#8f1d1d',
    image: '/cards/bomber.png',
    summary: 'Get into the Boiler Room. If you enter, you win alone and every other victory is void.',
    summaryZh: '設法進入鍋爐室。若進入鍋爐室則獨自獲勝，其他人的勝利無效。',
  },
  butler: {
    id: 'butler',
    name: 'Butler',
    nameZh: '管家',
    tint: '#3d4c6e',
    image: '/cards/butler.png',
    summary:
      'See the two guests who leave first. You win if the Murderer enters the Boiler Room. During discussion you may reveal yourself: those guest cards are shown, and you lose your vote.',
    summaryZh:
      '看見2名賓客先離去。若殺人魔進入鍋爐室則獲勝。討論時可公開自己角色，使離開的角色牌公開，但會失去投票權。',
  },
  detective: {
    id: 'detective',
    name: 'Detective',
    nameZh: '偵探',
    tint: '#8a6a32',
    image: '/cards/detective.png',
    summary:
      'You win if the Murderer enters the Boiler Room. During discussion you may reveal yourself, send one player into the Boiler Room, and skip straight to the result.',
    summaryZh:
      '若殺人魔進入鍋爐室則獲勝。討論時若公開自己角色，指定一人進入鍋爐室，直接進行遊戲的勝負階段。',
  },
  merchant: {
    id: 'merchant',
    name: 'Merchant',
    nameZh: '富商',
    tint: '#3f6b56',
    image: '/cards/merchant.png',
    summary:
      'Your vote counts as 2. You win if the Murderer enters the Boiler Room. You are revealed when ballots are opened.',
    summaryZh: '擁有2票。若殺人魔進入鍋爐室則獲勝。開票後公開自己角色，所投的票算2票。',
  },
  lawyer: {
    id: 'lawyer',
    name: 'Lawyer',
    nameZh: '律師',
    tint: '#8d7340',
    image: '/cards/lawyer.png',
    summary:
      'You win if the Murderer enters the Boiler Room. When ballots are opened you are revealed, and the player you voted for has their own ballot invalidated.',
    summaryZh: '若殺人魔進入鍋爐室則獲勝。開票後公開自己角色，你將票投給誰，他投的那1票無效。',
  },
  guest_red: {
    id: 'guest_red',
    name: 'Red Guest',
    nameZh: '客人（紅）',
    tint: '#a32020',
    image: '/cards/guest-red.png',
    summary: 'You win if the Murderer enters the Boiler Room.',
    summaryZh: '若殺人魔進入鍋爐室則獲勝。',
  },
  guest_blue: {
    id: 'guest_blue',
    name: 'Blue Guest',
    nameZh: '客人（藍）',
    tint: '#243e86',
    image: '/cards/guest-blue.png',
    summary: 'You win if the Murderer enters the Boiler Room.',
    summaryZh: '若殺人魔進入鍋爐室則獲勝。',
  },
  guest_yellow: {
    id: 'guest_yellow',
    name: 'Yellow Guest',
    nameZh: '客人（黃）',
    tint: '#a7841d',
    image: '/cards/guest-yellow.png',
    summary: 'You win if the Murderer enters the Boiler Room.',
    summaryZh: '若殺人魔進入鍋爐室則獲勝。',
  },
};

export type TableActionType =
  | 'confirm_pass'
  | 'save_draft'
  | 'submit_description'
  | 'chat'
  | 'react'
  | 'butler_reveal'
  | 'detective_lock'
  | 'cast_vote'
  | 'next_round'
  | 'return_lobby'
  | 'end_game';

export type TableAction =
  | { type: 'confirm_pass'; passIndex: 0 | 1; targetPlayerId: string; nonce?: string }
  | { type: 'save_draft'; text: string; nonce?: string }
  | { type: 'submit_description'; text: string; nonce?: string }
  | { type: 'chat'; text: string; nonce?: string }
  | { type: 'react'; messageId: string; emoji: string; nonce?: string }
  | { type: 'butler_reveal'; nonce?: string }
  | { type: 'detective_lock'; targetPlayerId: string; nonce?: string }
  | { type: 'cast_vote'; targetPlayerId: string; nonce?: string }
  | { type: 'next_round'; nonce?: string }
  | { type: 'return_lobby'; nonce?: string }
  | { type: 'end_game'; nonce?: string };

export interface TablePublicPlayer {
  id: string;
  name: string;
  seatIndex: number;
  connected: boolean;
  hasVoted: boolean;
  hasDescribed: boolean;
  canVote: boolean;
  isCurrent: boolean;
  typing: boolean;
}

export interface TableChatMessage {
  id: string;
  fromPlayerId: string;
  text: string;
  at: number;
  reactions: Array<{ playerId: string; emoji: string }>;
}

export interface TableActivity {
  id: string;
  at: number;
  kind: 'pass' | 'system' | 'phase' | 'vote' | 'ability';
  text: string;
}

export interface PassRecord {
  fromPlayerId: string;
  toPlayerId: string | null;
  card: BoilerRole;
  at: number;
}

export interface BallotView {
  voterId: string;
  targetId: string;
  weight: number;
  invalidated: boolean;
}

export interface RoundSummary {
  round: number;
  winner: Exclude<TableWinner, null>;
  lockedPlayerId: string | null;
  roles: Record<string, BoilerRole>;
  voteTotals: Record<string, number>;
  passes: PassRecord[];
  descriptions: Array<{ playerId: string; name: string; text: string }>;
}

export interface TablePublicView {
  phase: TablePhase;
  round: number;
  maxRounds: number;
  players: TablePublicPlayer[];
  currentPlayerId: string | null;
  phaseEndsAt: number | null;
  passTurnMs: number;
  activity: TableActivity[];
  chat: TableChatMessage[];
  descriptions: Array<{ playerId: string; text: string; at: number }>;
  passes: PassRecord[];
  departedGuests: BoilerRole[] | null;
  winner: TableWinner;
  lockedPlayerId: string | null;
  scores: Record<string, number>;
  voteTotals: Record<string, number> | null;
  voteBreakdown: BallotView[] | null;
  abilityNotes: string[];
  revealedRoles: Record<string, BoilerRole> | null;
  unseatedCard: BoilerRole | null;
  anonymousVoting: boolean;
  previousRounds: RoundSummary[];
  settings: TableSettings;
}

export interface PassTargetView {
  playerId: string | null;
  name: string;
  available: boolean;
}

export interface TablePrivateView {
  spectator: boolean;
  role: BoilerRole | null;
  hand: BoilerRole[];
  draft: string;
  description: string | null;
  myVote: string | null;
  departedGuests: BoilerRole[] | null;
  passTarget: PassTargetView | null;
  legalActions: TableActionType[];
  hostCommands: Array<'next_round' | 'return_lobby' | 'end_game'>;
}

export interface TablePlayerView {
  public: TablePublicView;
  private: TablePrivateView;
}
