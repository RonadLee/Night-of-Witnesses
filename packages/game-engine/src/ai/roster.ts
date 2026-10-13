import type { AiDifficulty, AiPersonality } from '@now/game-types';
import { createRng, pickRandom } from '../rng';

export interface AiProfile {
  id: string;
  name: string;
  avatarId: string;
  personality: AiPersonality;
  difficulty: AiDifficulty;
  flavor: string;
}

const NAME_POOL = [
  'Iris Vale',
  'Marcus Cole',
  'June Hart',
  'Otto Brink',
  'Vera Quill',
  'Nash Reed',
  'Clara Moth',
  'Leo Ash',
  'Mina Cross',
  'Rook Hale',
  'Sable Wren',
  'Theo Grey',
];

const PERSONALITIES: AiPersonality[] = [
  'aggressive',
  'logical',
  'quiet',
  'suspicious',
  'random',
  'deceptive',
];

const FLAVOR: Record<AiPersonality, string> = {
  aggressive: 'Accuses fast and presses hard.',
  logical: 'Stacks sightings like evidence.',
  quiet: 'Speaks rarely; watches closely.',
  suspicious: 'Trusts almost no one.',
  random: 'Unpredictable table energy.',
  deceptive: 'Sounds helpful while misleading.',
};

export function buildAiRoster(
  count: number,
  difficulty: AiDifficulty,
  seed: number,
): AiProfile[] {
  const rng = createRng(seed);
  const names = [...NAME_POOL];
  const roster: AiProfile[] = [];
  for (let i = 0; i < count; i++) {
    const nameIdx = Math.floor(rng() * names.length);
    const name = names.splice(nameIdx, 1)[0] ?? `Witness ${i + 1}`;
    const personality = pickRandom(PERSONALITIES, rng);
    roster.push({
      id: `ai-${i + 1}`,
      name,
      avatarId: `avatar-${(i % 8) + 1}`,
      personality,
      difficulty,
      flavor: FLAVOR[personality],
    });
  }
  return roster;
}

export { FLAVOR, PERSONALITIES };
