import type { Action, RoleId } from '@now/game-types';
import { applyAction } from './applyAction';
import { getView } from './getView';
import { createRng, pickRandom } from './rng';
import type { MatchState } from './state';

const ALL_ROLES: RoleId[] = [
  'murderer',
  'accomplice',
  'doctor',
  'detective',
  'spy',
  'priest',
];

export function chooseBotAction(state: MatchState, playerId: string, now = Date.now()): Action | null {
  const view = getView(state, playerId);
  const legal = view.private.legalActions;
  if (legal.length === 0) return null;

  const rng = createRng(state.seed + now + playerId.length * 17);
  const others = state.players.filter((p) => p.id !== playerId);

  if (legal.includes('keep_card')) {
    // Murderer-leaning: prefer keeping murderer if in hand
    const hand = view.private.hand;
    const murderIdx = hand.findIndex((r) => r === 'murderer');
    if (murderIdx === 0 || murderIdx === 1) {
      return { type: 'keep_card', keepIndex: murderIdx };
    }
    return { type: 'keep_card', keepIndex: rng() < 0.5 ? 0 : 1 };
  }

  if (legal.includes('announce_sighting')) {
    const through = pickRandom(others, rng);
    let claimed: RoleId = pickRandom(ALL_ROLES, rng);
    // Witnesses slightly prefer truth-ish: claim a role that exists in the match often
    if (view.private.role === 'murderer' || view.private.role === 'accomplice') {
      claimed = pickRandom(['doctor', 'detective', 'spy', 'priest'], rng);
    }
    return {
      type: 'announce_sighting',
      claimedRole: claimed,
      claimedThroughPlayerId: through.id,
    };
  }

  if (legal.includes('use_spy') && rng() < 0.7) {
    return { type: 'use_spy' };
  }
  if (legal.includes('use_doctor') && rng() < 0.5) {
    return { type: 'use_doctor', targetPlayerId: pickRandom(others, rng).id };
  }
  if (legal.includes('use_detective') && rng() < 0.5) {
    return { type: 'use_detective', targetPlayerId: pickRandom(others, rng).id };
  }
  if (legal.includes('use_priest') && rng() < 0.4) {
    return { type: 'use_priest', targetPlayerId: pickRandom(others, rng).id };
  }
  if (legal.includes('skip_ability')) {
    return { type: 'skip_ability' };
  }

  if (legal.includes('chat')) {
    return { type: 'chat', text: pickRandom(['Suspicious…', 'I trust the Doctor.', 'Vote carefully.'], rng) };
  }
  if (legal.includes('gesture')) {
    return { type: 'gesture', gestureId: pickRandom(['point', 'shrug', 'nod', 'deny'], rng) };
  }

  if (legal.includes('cast_vote')) {
    // Murderer avoids voting for self; prefer random other. Witnesses random.
    const candidates =
      view.private.role === 'murderer'
        ? others
        : state.players.filter((p) => p.id !== playerId || rng() < 0.05);
    const pool = candidates.length ? candidates : others;
    return { type: 'cast_vote', targetPlayerId: pickRandom(pool, rng).id };
  }

  if (legal.includes('end_discussion')) {
    return null; // bots don't force end; timer/human does
  }

  return null;
}

/** Run bot turns until a human must act or the phase is waiting (discussion/voting partial). */
export function runBots(state: MatchState, now = Date.now(), maxSteps = 200): MatchState {
  let current = state;
  for (let i = 0; i < maxSteps; i++) {
    current = tickBotsOnce(current, now + i);
    const waitingHuman = current.players.some((p) => {
      if (p.isBot) return false;
      return getView(current, p.id).private.legalActions.some(
        (a) => a !== 'chat' && a !== 'gesture' && a !== 'end_discussion',
      );
    });
    if (waitingHuman) break;
    if (current.phase === 'result') break;
    if (current.phase === 'discussion') break;
    const anyBotLegal = current.players.some(
      (p) => p.isBot && chooseBotAction(current, p.id, now + i),
    );
    if (!anyBotLegal) break;
  }
  return current;
}

function tickBotsOnce(state: MatchState, now: number): MatchState {
  let current = state;
  for (const p of current.players) {
    if (!p.isBot) continue;
    const action = chooseBotAction(current, p.id, now);
    if (!action) continue;
    if (action.type === 'end_discussion') continue;
    const result = applyAction(current, p.id, action, now);
    if (result.ok) current = result.state;
  }
  return current;
}
