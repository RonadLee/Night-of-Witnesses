import type { AiDifficulty, CampaignLeague, SoloStats } from '@now/game-types';
import type { MatchState } from '@now/game-engine';
import type { SoloLobbyConfig } from '@now/game-types';

const STATS_KEY = 'now_solo_stats_v1';
const SAVE_KEY = 'now_solo_save_v1';
const HISTORY_KEY = 'now_solo_history_v1';

export const DEFAULT_STATS: SoloStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  correctVotes: 0,
  totalVotes: 0,
  averageScore: 0,
  byDifficulty: {
    easy: { played: 0, wins: 0 },
    normal: { played: 0, wins: 0 },
    hard: { played: 0, wins: 0 },
    expert: { played: 0, wins: 0 },
  },
  unlockedLeagues: ['beginner'],
  unlockedAvatars: ['avatar-you', 'avatar-1', 'avatar-2'],
  unlockedThemes: ['ember-fog'],
};

export function loadStats(): SoloStats {
  if (typeof window === 'undefined') return structuredClone(DEFAULT_STATS);
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return structuredClone(DEFAULT_STATS);
    return { ...structuredClone(DEFAULT_STATS), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_STATS);
  }
}

export function saveStats(stats: SoloStats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function recordMatchResult(opts: {
  difficulty: AiDifficulty;
  won: boolean;
  score: number;
  votedCorrectly: boolean;
}): SoloStats {
  const stats = loadStats();
  stats.gamesPlayed += 1;
  if (opts.won) stats.wins += 1;
  else stats.losses += 1;
  stats.totalVotes += 1;
  if (opts.votedCorrectly) stats.correctVotes += 1;
  stats.averageScore =
    (stats.averageScore * (stats.gamesPlayed - 1) + opts.score) / stats.gamesPlayed;
  const bucket = stats.byDifficulty[opts.difficulty];
  bucket.played += 1;
  if (opts.won) bucket.wins += 1;

  // Campaign unlocks
  if (stats.wins >= 2 && !stats.unlockedLeagues.includes('intermediate')) {
    stats.unlockedLeagues.push('intermediate');
    stats.unlockedAvatars.push('avatar-3', 'avatar-4');
  }
  if (stats.wins >= 5 && !stats.unlockedLeagues.includes('advanced')) {
    stats.unlockedLeagues.push('advanced');
    stats.unlockedThemes.push('boiler-steel');
  }
  if (stats.wins >= 10 && !stats.unlockedLeagues.includes('expert')) {
    stats.unlockedLeagues.push('expert');
    stats.unlockedAvatars.push('avatar-5', 'avatar-6', 'avatar-7', 'avatar-8');
  }
  saveStats(stats);
  return stats;
}

export interface SoloSaveBlob {
  savedAt: number;
  config: SoloLobbyConfig;
  humanId: string;
  state: MatchState;
}

export function autosave(blob: SoloSaveBlob): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
}

export function loadSave(): SoloSaveBlob | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SoloSaveBlob) : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export interface MatchHistoryEntry {
  at: number;
  winnerSide: string;
  difficulty: AiDifficulty;
  league: CampaignLeague | null;
  playerCount: number;
}

export function pushHistory(entry: MatchHistoryEntry): void {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list: MatchHistoryEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* ignore */
  }
}

export function loadHistory(): MatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const DEFAULT_SOLO_CONFIG: SoloLobbyConfig = {
  aiCount: 4,
  difficulty: 'normal',
  deckType: 'standard',
  rounds: 1,
  descriptionSeconds: 30,
  discussionSeconds: 120,
  votingSeconds: 10,
  passDirection: 'clockwise',
  specialCards: true,
  campaignLeague: null,
};
