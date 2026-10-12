import type { Action, RoleId } from '@now/game-types';
import { getView } from '../getView';
import { createRng, pickRandom } from '../rng';
import { isGuestRole } from '../roles';
import type { MatchState } from '../state';
import { bumpSuspicion, difficultyNoise, mostSuspicious, remember, roleThreat } from './mind';

const ALL_ROLES: RoleId[] = [
  'murderer',
  'accomplice',
  'bomber',
  'butler',
  'detective',
  'merchant',
  'lawyer',
  'guest_yellow',
  'guest_blue',
  'guest_red',
];

const COVER_ROLES: RoleId[] = [
  'butler',
  'detective',
  'merchant',
  'lawyer',
  'guest_yellow',
  'guest_blue',
  'guest_red',
];

function chatLine(state: MatchState, playerId: string, rng: () => number): string {
  const mind = state.aiMinds[playerId];
  const suspect = mind ? mostSuspicious(mind) : null;
  const name = suspect
    ? (state.players.find((p) => p.id === suspect)?.name ?? 'them')
    : 'someone';
  const role = state.players.find((p) => p.id === playerId)?.role;
  const isMurder = role === 'murderer' || role === 'accomplice';
  const isBomber = role === 'bomber';

  switch (mind?.personality) {
    case 'aggressive':
      return pickRandom(
        [
          `I say send ${name} to the Private Room.`,
          `${name} is lying — vote them.`,
          `爆鎖室 for ${name}.`,
        ],
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
        [
          `I trust no one — especially ${name}.`,
          `Every smile looks fake tonight.`,
          `Why so quiet, ${name}?`,
        ],
        rng,
      );
    case 'deceptive':
      if (isBomber) {
        return pickRandom(
          [`Vote me if you dare.`, `I am just a guest…`, `Focus on ${name}, not me.`],
          rng,
        );
      }
      return isMurder
        ? pickRandom(
            [
              `I cleared ${name} earlier.`,
              `Focus elsewhere — ${name} is fine.`,
              `The Detective should check me last.`,
            ],
            rng,
          )
        : pickRandom([`Something about ${name} feels off.`, `I am still gathering threads.`], rng);
    case 'random':
    default:
      return pickRandom(
        ['Chaos is a clue.', 'Who held the Murderer card?', 'Watch the Private Room votes.'],
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
  const isBomber = myRole === 'bomber';

  if (legal.includes('keep_card') && view.private.hand.length === 2) {
    const hand = view.private.hand;
    let keepIndex: 0 | 1 = rng() < 0.5 ? 0 : 1;
    if (mind && mind.difficulty !== 'easy') {
      const murderIdx = hand.findIndex((r) => r === 'murderer') as -1 | 0 | 1;
      const bomberIdx = hand.findIndex((r) => r === 'bomber') as -1 | 0 | 1;
      if (isMurderSide || (murderIdx >= 0 && rng() > noise)) {
        if (murderIdx === 0 || murderIdx === 1) keepIndex = murderIdx;
        else if (hand.includes('accomplice')) {
          keepIndex = hand[0] === 'accomplice' ? 0 : 1;
        }
      } else if (isBomber || (bomberIdx >= 0 && myRole === null && rng() > 0.5)) {
        if (bomberIdx === 0 || bomberIdx === 1) keepIndex = bomberIdx;
      } else if (murderIdx >= 0 && mind.difficulty !== 'normal' && rng() > noise * 0.5) {
        // Dump murderer card if possible
        keepIndex = (1 - murderIdx) as 0 | 1;
      }
    }
    const passRole = hand[1 - keepIndex];
    if (mind && passRole) remember(mind, `Passed ${passRole}`);
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
      if (isMurderSide || isBomber || mind.personality === 'deceptive') {
        claimed = pickRandom(COVER_ROLES, rng);
        const innocent = others.find((p) => {
          const r = p.role;
          return r && r !== 'murderer' && r !== 'accomplice' && r !== 'bomber';
        });
        if (innocent && rng() > 0.4) through = innocent;
      } else if (view.private.role) {
        claimed = pickRandom([view.private.role, 'guest_yellow', 'detective'], rng);
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

  if (legal.includes('use_butler') && mind) {
    const guests = others.filter((p) => isGuestRole(p.role));
    if (guests.length >= 2 && rng() > noise * 0.5) {
      const shuffled = [...guests].sort(() => rng() - 0.5);
      return {
        type: 'use_butler',
        targetA: shuffled[0]!.id,
        targetB: shuffled[1]!.id,
      };
    }
    // Not enough colored guests → skip
  }

  if (legal.includes('use_lawyer') && mind) {
    const target = mostSuspicious(mind) ?? pickRandom(others, rng).id;
    if (rng() > noise) return { type: 'use_lawyer', targetPlayerId: target };
  }

  if (legal.includes('use_detective') && mind) {
    let targetId = mostSuspicious(mind) ?? pickRandom(others, rng).id;
    if (isMurderSide) {
      // Murderer detective is rare; if so, send a guest scapegoat
      const scapegoat = others.find((p) => isGuestRole(p.role));
      if (scapegoat) targetId = scapegoat.id;
    } else if (mind.difficulty === 'expert' && rng() > 0.4) {
      const murderSeat = state.players.find((p) => p.role === 'murderer' && p.id !== playerId);
      if (murderSeat) targetId = murderSeat.id;
    }
    if (rng() > noise * 0.8) return { type: 'use_detective', targetPlayerId: targetId };
  }

  if (legal.includes('skip_ability')) {
    return { type: 'skip_ability' };
  }

  if (legal.includes('chat') && mind && mind.chatBudget > 0) {
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
      for (const s of state.sightings) {
        if (s.fromPlayerId === playerId) continue;
        bumpSuspicion(mind, s.claimedThroughPlayerId, 0.04);
        if (s.claimedRole === 'murderer') bumpSuspicion(mind, s.fromPlayerId, 0.03);
      }

      if (isBomber) {
        // Bomber wants to enter Private Room — try to attract votes to self via... can't vote self typically.
        // Vote a popular scapegoat while hoping others vote bomber; or vote randomly.
        // Prefer voting someone else so vote doesn't look self-serving; hard bots vote least suspicious.
        const safe = others.sort(
          (a, b) => (mind.suspicion[a.id] ?? 0) - (mind.suspicion[b.id] ?? 0),
        );
        targetId = safe[0]?.id ?? others[0]!.id;
      } else if (isMurderSide) {
        // Avoid locking murderer; send a guest/neutral
        const safe = others
          .filter((p) => p.role !== 'murderer' && p.role !== 'accomplice')
          .sort((a, b) => (mind.suspicion[a.id] ?? 0) - (mind.suspicion[b.id] ?? 0));
        targetId = safe[0]?.id ?? others[0]!.id;
        if (mind.difficulty === 'easy' && rng() < 0.5) targetId = pickRandom(others, rng).id;
      } else if (mind.difficulty === 'easy' || rng() < noise) {
        targetId = pickRandom(others, rng).id;
      } else {
        targetId = mostSuspicious(mind) ?? targetId;
        const murderSeat = state.players.find((p) => p.role === 'murderer' && p.id !== playerId);
        if (murderSeat && mind.difficulty === 'expert' && rng() > 0.35) {
          bumpSuspicion(mind, murderSeat.id, roleThreat('murderer') * 0.15);
          targetId = mostSuspicious(mind) ?? murderSeat.id;
        }
        // Prefer voting bomber if known threat and murderer already "safe"
        const bomber = state.players.find((p) => p.role === 'bomber' && p.id !== playerId);
        if (bomber && mind.difficulty === 'hard' && rng() > 0.7) {
          bumpSuspicion(mind, bomber.id, 0.2);
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
  const roleHint = player.role ? ` as ${player.role}` : '';
  return `${player.name}${roleHint} (${mind.personality}/${mind.difficulty}) focused suspicion on ${topName}. Memory: ${mind.memory.slice(-3).join('; ') || 'thin'}.`;
}
