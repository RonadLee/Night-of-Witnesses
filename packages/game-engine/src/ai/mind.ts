import type { AiDifficulty, AiPersonality, RoleId } from '@now/game-types';

export interface AiMind {
  playerId: string;
  personality: AiPersonality;
  difficulty: AiDifficulty;
  suspicion: Record<string, number>;
  memory: string[];
  lastVoteTarget: string | null;
  chatBudget: number;
}

export function createMind(
  playerId: string,
  personality: AiPersonality,
  difficulty: AiDifficulty,
  playerIds: string[],
): AiMind {
  const suspicion: Record<string, number> = {};
  for (const id of playerIds) {
    if (id !== playerId) suspicion[id] = 0.35;
  }
  return {
    playerId,
    personality,
    difficulty,
    suspicion,
    memory: [],
    lastVoteTarget: null,
    chatBudget: personality === 'quiet' ? 1 : personality === 'aggressive' ? 4 : 2,
  };
}

export function bumpSuspicion(mind: AiMind, targetId: string, delta: number): void {
  if (targetId === mind.playerId) return;
  const cur = mind.suspicion[targetId] ?? 0.35;
  mind.suspicion[targetId] = Math.max(0, Math.min(1, cur + delta));
}

export function remember(mind: AiMind, note: string): void {
  mind.memory.push(note);
  if (mind.memory.length > 24) mind.memory.shift();
}

export function difficultyNoise(difficulty: AiDifficulty): number {
  switch (difficulty) {
    case 'easy':
      return 0.55;
    case 'normal':
      return 0.3;
    case 'hard':
      return 0.15;
    case 'expert':
      return 0.05;
  }
}

export function mostSuspicious(mind: AiMind, excludeIds: string[] = []): string | null {
  let bestId: string | null = null;
  let best = -1;
  for (const [id, score] of Object.entries(mind.suspicion)) {
    if (excludeIds.includes(id)) continue;
    if (score > best) {
      best = score;
      bestId = id;
    }
  }
  return bestId;
}

export function roleThreat(role: RoleId | null): number {
  if (role === 'murderer') return 1;
  if (role === 'accomplice') return 0.7;
  return 0.2;
}
