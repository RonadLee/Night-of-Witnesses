import type { Action, RoleId } from '@now/game-types';
import { getView } from '../getView';
import { createRng, pickRandom } from '../rng';
import type { MatchState } from '../state';
import { bumpSuspicion, difficultyNoise, mostSuspicious, remember, roleThreat } from './mind';

const ALL_ROLES: RoleId[] = [
  'murderer',
  'accomplice',
  'doctor',
  'detective',
  'spy',
  'priest',
];

function chatLine(state: MatchState, playerId: string, rng: () => number): string {
  const mind = state.aiMinds[playerId];
  const suspect = mind ? mostSuspicious(mind) : null;
  const name = suspect
    ? (state.players.find((p) => p.id === suspect)?.name ?? 'them')
    : 'someone';
  const role = state.players.find((p) => p.id === playerId)?.role;
  const isMurder = role === 'murderer' || role === 'accomplice';

  switch (mind?.personality) {
    case 'aggressive':
      return pickRandom(
        [`I say lock ${name}.`, `${name} is lying — vote them.`, `Boiler Room for ${name}.`],
        rng,
      );
    case 'logical':
      return pickRandom(
        [
          `Sightings around ${name} do not line up.`,
          `If the Guest Room is clean, pressure ${name}.`,
          `Count the passes: ${name} looks weakest.`,
        ],
        rng,
      );
    case 'quiet':
      return pickRandom([`…watching.`, `Hmm.`, `Noted.`], rng);
    case 'suspicious':
      return pickRandom(
        [`I trust no one — especially ${name}.`, `Every smile looks fake tonight.`, `Why so quiet, ${name}?`],
        rng,
      );
    case 'deceptive':
      return isMurder
        ? pickRandom(
            [`I cleared ${name} earlier.`, `Focus elsewhere — ${name} is fine.`, `The Doctor should check me last.`],
            rng,
          )
        : pickRandom([`Something about ${name} feels off.`, `I am still gathering threads.`], rng);
    case 'random':
    default:
      return pickRandom(
        ['Chaos is a clue.', 'The steam hides everything.', 'Who held the Murderer card?'],
        rng,
      );
  }
}

export function chooseAiAction(
  state: MatchState,
  playerId: string,
  now = Date.now(),
): Action | null {
  const view = getView(state, playerId);
  const legal = view.private.legalActions;
  if (legal.length === 0) return null;

  const mind = state.aiMinds[playerId];
  const rng = createRng(state.seed + now + playerId.length * 31 + state.round * 97);
  const others = state.players.filter((p) => p.id !== playerId);
  const noise = mind ? difficultyNoise(mind.difficulty) : 0.4;
  const myRole = view.private.role;
  const isMurderSide = myRole === 'murderer' || myRole === 'accomplice';

  if (legal.includes('keep_card') && view.private.hand.length === 2) {
    const hand = view.private.hand;
    let keepIndex: 0 | 1 = rng() < 0.5 ? 0 : 1;
    if (mind && mind.difficulty !== 'easy') {
      const murderIdx = hand.findIndex((r) => r === 'murderer') as -1 | 0 | 1;
      const witnessIdx = hand.findIndex((r) => r !== 'murderer' && r !== 'accomplice') as
        | -1
        | 0
        | 1;
      if (isMurderSide || (murderIdx >= 0 && rng() > noise)) {
        // Murder side / high skill: keep murderer if drawn; else prefer non-revealable strong card
        if (murderIdx === 0 || murderIdx === 1) keepIndex = murderIdx;
        else if (hand.includes('accomplice')) {
          keepIndex = hand[0] === 'accomplice' ? 0 : 1;
        }
      } else if (witnessIdx === 0 || witnessIdx === 1) {
        // Witnesses dump murderer if they can (hard+)
        if (murderIdx >= 0 && mind.difficulty !== 'normal' && rng() > noise * 0.5) {
          keepIndex = (1 - murderIdx) as 0 | 1;
        } else {
          keepIndex = witnessIdx;
        }
      }
    }
    const passRole = hand[1 - keepIndex];
    if (mind && passRole) {
      remember(mind, `Passed ${passRole}`);
    }
    return { type: 'keep_card', keepIndex };
  }

  if (legal.includes('announce_sighting')) {
    let through = pickRandom(others, rng);
    let claimed: RoleId = pickRandom(ALL_ROLES, rng);
    if (mind && mind.difficulty !== 'easy' && rng() > noise) {
      const sus = mostSuspicious(mind);
      if (sus && mind.personality !== 'deceptive') {
        through = state.players.find((p) => p.id === sus) ?? through;
      }
      if (isMurderSide || mind.personality === 'deceptive') {
        claimed = pickRandom(['doctor', 'detective', 'spy', 'priest'], rng);
        const innocent = others.find((p) => {
          const r = p.role;
          return r && r !== 'murderer' && r !== 'accomplice';
        });
        if (innocent && rng() > 0.4) through = innocent;
      } else if (view.private.hand[0]) {
        claimed = pickRandom([view.private.role ?? 'doctor', 'spy', 'detective'], rng);
      }
    }
    const textTemplates = [
      `I saw the ${claimed} card pass near ${through.name}.`,
      `${through.name} handled something like ${claimed}.`,
      `Sighting: ${claimed} through ${through.name}.`,
    ];
    return {
      type: 'announce_sighting',
      claimedRole: claimed,
      claimedThroughPlayerId: through.id,
      text: pickRandom(textTemplates, rng),
    };
  }

  // Abilities — smarter use on higher difficulty
  if (legal.includes('use_spy') && (!mind || mind.difficulty !== 'easy' || rng() < 0.5)) {
    if (rng() > noise * 0.6) return { type: 'use_spy' };
  }
  if (legal.includes('use_doctor') && mind) {
    const target = mostSuspicious(mind) ?? pickRandom(others, rng).id;
    if (rng() > noise) return { type: 'use_doctor', targetPlayerId: target };
  }
  if (legal.includes('use_detective') && mind) {
    const target = mostSuspicious(mind) ?? pickRandom(others, rng).id;
    if (rng() > noise) return { type: 'use_detective', targetPlayerId: target };
  }
  if (legal.includes('use_priest') && mind) {
    const target = mostSuspicious(mind) ?? pickRandom(others, rng).id;
    if (rng() > noise * 1.2) return { type: 'use_priest', targetPlayerId: target };
  }
  if (legal.includes('skip_ability')) {
    return { type: 'skip_ability' };
  }

  if (legal.includes('chat') && mind && mind.chatBudget > 0) {
    // Only emit chat sometimes so discussion feels paced
    if (rng() < (mind.personality === 'quiet' ? 0.25 : 0.55)) {
      mind.chatBudget -= 1;
      return { type: 'chat', text: chatLine(state, playerId, rng) };
    }
    return null;
  }

  if (legal.includes('gesture')) {
    return { type: 'gesture', gestureId: pickRandom(['point', 'shrug', 'nod', 'deny'], rng) };
  }

  if (legal.includes('cast_vote')) {
    let targetId = pickRandom(others, rng).id;
    if (mind) {
      // Update suspicion from sightings lightly
      for (const s of state.sightings) {
        if (s.fromPlayerId === playerId) continue;
        bumpSuspicion(mind, s.claimedThroughPlayerId, 0.04);
        if (s.claimedRole === 'murderer') bumpSuspicion(mind, s.fromPlayerId, 0.03);
      }
      if (isMurderSide) {
        // Avoid voting self; prefer high-trust witness or random other
        const safe = others
          .filter((p) => p.role !== 'murderer' && p.role !== 'accomplice')
          .sort((a, b) => (mind.suspicion[a.id] ?? 0) - (mind.suspicion[b.id] ?? 0));
        targetId = safe[0]?.id ?? others[0]!.id;
        if (mind.difficulty === 'easy' && rng() < 0.5) targetId = pickRandom(others, rng).id;
      } else if (mind.difficulty === 'easy' || rng() < noise) {
        targetId = pickRandom(others, rng).id;
      } else {
        targetId = mostSuspicious(mind) ?? targetId;
        // Expert: slightly prefer actual murderer if somehow known via private peeks — not available; use suspicion
        const murderSeat = state.players.find((p) => p.role === 'murderer' && p.id !== playerId);
        if (murderSeat && mind.difficulty === 'expert' && rng() > 0.35) {
          bumpSuspicion(mind, murderSeat.id, roleThreat('murderer') * 0.15);
          targetId = mostSuspicious(mind) ?? murderSeat.id;
        }
      }
      mind.lastVoteTarget = targetId;
      remember(mind, `Voted ${targetId}`);
    }
    return { type: 'cast_vote', targetPlayerId: targetId };
  }

  return null;
}

export function reasoningSummary(state: MatchState, playerId: string): string {
  const mind = state.aiMinds[playerId];
  const player = state.players.find((p) => p.id === playerId);
  if (!mind || !player) return '';
  const top = mostSuspicious(mind);
  const topName = top ? (state.players.find((p) => p.id === top)?.name ?? top) : 'nobody';
  return `${player.name} (${mind.personality}/${mind.difficulty}) focused suspicion on ${topName}. Memory: ${mind.memory.slice(-3).join('; ') || 'thin'}.`;
}
