import type { MatchVariant, RoleId, Team, TicketBreakdown } from '@now/game-types';
import { MAX_PLAYERS, MIN_PLAYERS } from '@now/game-types';
import { shuffleInPlace } from './rng';
import type { MatchState } from './state';

export const ROLE_CATALOG: Record<
  RoleId,
  {
    en: string;
    zh: string;
    image: string;
    abilityHeaderEn: string;
    abilityHeaderZh: string;
    abilityBodyEn: string;
    abilityBodyZh: string;
  }
> = {
  murderer: {
    en: 'Murderer',
    zh: '殺人魔',
    image: '/roles/murderer.png',
    abilityHeaderEn: 'Avoid the Private Room',
    abilityHeaderZh: '避免進入爆鎖室',
    abilityBodyEn: 'Win if you do not enter the Private Room.',
    abilityBodyZh: '若未進入爆鎖室則獲勝。',
  },
  accomplice: {
    en: 'Accomplice',
    zh: '共犯',
    image: '/roles/accomplice.png',
    abilityHeaderEn: "Murderer's assistant",
    abilityHeaderZh: '殺人魔的助手',
    abilityBodyEn: 'Win if the Murderer wins.',
    abilityBodyZh: '若殺人魔獲勝，共犯也一同獲勝。',
  },
  bomber: {
    en: 'Bomber',
    zh: '炸彈客',
    image: '/roles/bomber.png',
    abilityHeaderEn: 'Enter the Private Room',
    abilityHeaderZh: '設法進入爆鎖室',
    abilityBodyEn: 'If you enter the Private Room, you win alone; all others lose.',
    abilityBodyZh: '若進入爆鎖室則獨自獲勝，其他人的勝利無效。',
  },
  butler: {
    en: 'Butler',
    zh: '管家',
    image: '/roles/butler.png',
    abilityHeaderEn: 'See 2 guest identities',
    abilityHeaderZh: '看見2名賓客身分',
    abilityBodyEn:
      'Secretly view 2 guests. If the Murderer enters the Private Room, those guests score as White Guests (no color). They are not told.',
    abilityBodyZh:
      '查看2名客人的身分。若殺人魔進入爆鎖室，被查看的客人失去所有顏色身分，計分時視為白色客人。被查看的客人不會被告知。',
  },
  detective: {
    en: 'Detective',
    zh: '偵探',
    image: '/roles/detective.png',
    abilityHeaderEn: 'Send one player to the Private Room',
    abilityHeaderZh: '立刻將一名玩家送進爆鎖室',
    abilityBodyEn:
      'Immediately send one player to the Private Room. If Murderer: reveal one Guest. Else: resolve that player’s ability, then win/loss.',
    abilityBodyZh:
      '立刻將一名玩家送進爆鎖室。若為殺人魔則揭露一名客人；否則立即執行該玩家的特殊能力並進入勝負結算。',
  },
  merchant: {
    en: 'Merchant',
    zh: '富商',
    image: '/roles/merchant.png',
    abilityHeaderEn: 'Start with 2 tickets',
    abilityHeaderZh: '擁有2票',
    abilityBodyEn:
      'Begin with 2 tickets. If the Murderer enters the Private Room, reveal yourself and gain 2 more tickets.',
    abilityBodyZh: '擁有2票。若殺人魔進入爆鎖室，則揭露自己身分，並額外獲得2票。',
  },
  lawyer: {
    en: 'Lawyer',
    zh: '律師',
    image: '/roles/lawyer.png',
    abilityHeaderEn: 'Invalidate one ticket',
    abilityHeaderZh: '指定一名玩家的票數無效',
    abilityBodyEn:
      'Choose a player. If the Murderer enters the Private Room, reveal yourself and that player loses 1 ticket at scoring.',
    abilityBodyZh:
      '指定一名玩家的票數無效。若殺人魔進入爆鎖室，則揭露自己身分，結算時該角色少計1票。',
  },
  guest_yellow: {
    en: 'Yellow Guest',
    zh: '黃色客人',
    image: '/roles/guest-yellow.png',
    abilityHeaderEn: 'Guest',
    abilityHeaderZh: '客人',
    abilityBodyEn: 'Win if the Murderer enters the Private Room.',
    abilityBodyZh: '若殺人魔進入爆鎖室則獲勝。',
  },
  guest_blue: {
    en: 'Blue Guest',
    zh: '藍色客人',
    image: '/roles/guest-blue.png',
    abilityHeaderEn: 'Guest',
    abilityHeaderZh: '客人',
    abilityBodyEn: 'Win if the Murderer enters the Private Room.',
    abilityBodyZh: '若殺人魔進入爆鎖室則獲勝。',
  },
  guest_red: {
    en: 'Red Guest',
    zh: '紅色客人',
    image: '/roles/guest-red.png',
    abilityHeaderEn: 'Guest',
    abilityHeaderZh: '客人',
    abilityBodyEn: 'Win if the Murderer enters the Private Room.',
    abilityBodyZh: '若殺人魔進入爆鎖室則獲勝。',
  },
};

export const V1_WITNESS_ROLES: RoleId[] = [
  'butler',
  'detective',
  'merchant',
  'lawyer',
  'guest_yellow',
  'guest_blue',
  'guest_red',
];

export function teamOf(role: RoleId): Team {
  if (role === 'murderer' || role === 'accomplice') return 'murderer_side';
  if (role === 'bomber') return 'bomber';
  if (role === 'butler' || role === 'detective' || role === 'merchant' || role === 'lawyer') {
    return 'neutral';
  }
  return 'guest_side';
}

export function isGuestRole(role: RoleId | null | undefined): boolean {
  return role === 'guest_yellow' || role === 'guest_blue' || role === 'guest_red';
}

export function buildDeck(playerCount: number, variant: MatchVariant, rng: () => number): RoleId[] {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`Player count must be ${MIN_PLAYERS}-${MAX_PLAYERS}`);
  }

  const deck: RoleId[] = [];
  const murderers = variant.deckType === 'double_murderer' ? 2 : variant.murdererCount;
  for (let i = 0; i < murderers; i++) deck.push('murderer');

  if (murderers === 1 && playerCount >= 6) deck.push('accomplice');
  if (variant.specialCards && playerCount >= 5) deck.push('bomber');

  // Core specials
  const specials: RoleId[] = ['detective', 'butler', 'merchant', 'lawyer'];
  for (const s of specials) {
    if (!deck.includes(s)) deck.push(s);
  }

  const needed = playerCount + 1;
  const guests: RoleId[] = ['guest_yellow', 'guest_blue', 'guest_red'];
  let gi = 0;
  while (deck.length < needed) {
    if (variant.deckType === 'witness_heavy') {
      deck.push(guests[gi % guests.length]!);
    } else {
      deck.push(guests[gi % guests.length]!);
    }
    gi++;
  }

  // Trim if over (shouldn't often happen)
  while (deck.length > needed) {
    const idx = deck.findIndex((r) => isGuestRole(r));
    if (idx >= 0) deck.splice(idx, 1);
    else deck.pop();
  }

  shuffleInPlace(deck, rng);
  return deck;
}

export function baseTicketsForRole(role: RoleId | null): number {
  if (role === 'merchant') return 2;
  return 1;
}

/**
 * Official win resolution for Private Room (爆鎖室):
 * - Bomber in room → Bomber solo win
 * - Murderer in room → Guest side wins (Murderer/Accomplice lose)
 * - Murderer NOT in room → Murderer side wins
 *
 * Note: Murderer card text is "avoid Private Room"; Guest cards win when Murderer enters.
 */
export function resolvePrivateRoomOutcome(state: MatchState): {
  winnerSide: NonNullable<MatchState['winnerSide']>;
  winningRoleIds: RoleId[];
  ticketBreakdown: TicketBreakdown[];
} {
  const roomId = state.privateRoomPlayerId;
  const roomPlayer = state.players.find((p) => p.id === roomId);
  const roomRole = roomPlayer?.role ?? null;
  const murdererEntered = roomRole === 'murderer';

  let winnerSide: NonNullable<MatchState['winnerSide']> = 'none';
  const winningRoleIds: RoleId[] = [];

  if (roomRole === 'bomber') {
    winnerSide = 'bomber';
    winningRoleIds.push('bomber');
  } else if (murdererEntered) {
    winnerSide = 'guest_side';
    for (const p of state.players) {
      if (!p.role) continue;
      if (isGuestRole(p.role) || p.role === 'butler' || p.role === 'detective' || p.role === 'merchant' || p.role === 'lawyer') {
        // Neutrals / guests who oppose murderer
        if (p.role !== 'accomplice' && p.role !== 'murderer' && p.role !== 'bomber') {
          winningRoleIds.push(p.role);
        }
      }
    }
  } else {
    winnerSide = 'murderer_side';
    winningRoleIds.push('murderer');
    if (state.players.some((p) => p.role === 'accomplice')) winningRoleIds.push('accomplice');
  }

  const ticketBreakdown = computeTickets(state, murdererEntered);
  return { winnerSide, winningRoleIds: [...new Set(winningRoleIds)], ticketBreakdown };
}

export function computeTickets(state: MatchState, murdererEntered: boolean): TicketBreakdown[] {
  const whitened = new Set(state.butlerWhitenedPlayerIds);
  const rows: TicketBreakdown[] = [];

  for (const p of state.players) {
    const base = baseTicketsForRole(p.role);
    let merchantBonus = 0;
    if (p.role === 'merchant' && murdererEntered) {
      merchantBonus = 2;
      p.roleRevealed = true;
    }
    let lawyerPenalty = 0;
    if (murdererEntered && state.lawyerTargetId === p.id) {
      lawyerPenalty = 1;
      const lawyer = state.players.find((x) => x.role === 'lawyer');
      if (lawyer) lawyer.roleRevealed = true;
    }
    const butlerWhitened = whitened.has(p.id) && murdererEntered;
    const finalTickets = Math.max(0, base + merchantBonus - lawyerPenalty);
    rows.push({
      playerId: p.id,
      baseTickets: base,
      merchantBonus,
      lawyerPenalty,
      finalTickets,
      butlerWhitened,
    });
    p.tickets = finalTickets;
  }
  return rows;
}
