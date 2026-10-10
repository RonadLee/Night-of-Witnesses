import type { Action, RoleId } from '@now/game-types';
import { dealDrawToCurrent } from './createMatch';
import { createRng, pickRandom } from './rng';
import { teamOf } from './roles';
import { cloneState, type EngineResult, type MatchState } from './state';

function fail(state: MatchState, error: string): EngineResult {
  return { ok: false, error, state };
}

function ok(state: MatchState): EngineResult {
  return { ok: true, state };
}

function playerById(state: MatchState, id: string) {
  return state.players.find((p) => p.id === id);
}

function currentPlayer(state: MatchState) {
  return state.players[state.currentSeat] ?? null;
}

function beginInformation(state: MatchState): void {
  state.phase = 'information';
  state.currentSeat = 0;
  state.phaseEndsAt = null;
}

function beginDiscussion(state: MatchState, now: number): void {
  state.phase = 'discussion';
  state.currentSeat = -1;
  state.phaseEndsAt = now + state.variant.discussionSeconds * 1000;
}

function beginVoting(state: MatchState): void {
  state.phase = 'voting';
  state.currentSeat = -1;
  state.phaseEndsAt = null;
  state.votes = {};
  for (const p of state.players) {
    p.hasVoted = false;
    p.voteTargetId = null;
  }
}

function applyScores(state: MatchState): void {
  if (state.winnerSide === 'witnesses') {
    for (const p of state.players) {
      if (p.role && teamOf(p.role) === 'witness') {
        state.scores[p.id] = (state.scores[p.id] ?? 0) + 2;
      }
    }
  } else if (state.winnerSide === 'murderers') {
    for (const p of state.players) {
      if (p.role && teamOf(p.role) === 'murderer') {
        state.scores[p.id] = (state.scores[p.id] ?? 0) + 3;
      }
    }
  }
}

function resolveVotes(state: MatchState): void {
  const tallies = new Map<string, number>();
  const silenced = state.players.find((p) => p.isSilenced);
  for (const [voterId, targetId] of Object.entries(state.votes)) {
    const voter = playerById(state, voterId);
    let weight = 1;
    // Priest: double vote if they silenced a Murderer and vote for that Murderer
    if (
      voter?.role === 'priest' &&
      silenced?.role === 'murderer' &&
      targetId === silenced.id
    ) {
      weight = 2;
    }
    tallies.set(targetId, (tallies.get(targetId) ?? 0) + weight);
  }

  let best = 0;
  for (const v of tallies.values()) {
    if (v > best) best = v;
  }
  const tied = [...tallies.entries()].filter(([, v]) => v === best).map(([id]) => id);

  if (tied.length === 0) {
    state.winnerSide = 'murderers';
    state.phase = 'result';
    applyScores(state);
    return;
  }

  if (tied.length > 1) {
    if (state.revoteCount === 0) {
      state.revoteCount = 1;
      beginVoting(state);
      return;
    }
    const rng = createRng(state.seed + state.round * 997 + state.revoteCount);
    const chosen = pickRandom(tied, rng);
    lockPlayer(state, chosen);
    return;
  }

  lockPlayer(state, tied[0]!);
}

function lockPlayer(state: MatchState, playerId: string): void {
  const target = playerById(state, playerId);
  if (!target) {
    state.winnerSide = 'murderers';
    state.phase = 'result';
    applyScores(state);
    return;
  }
  target.isLocked = true;
  state.lockedPlayerId = playerId;
  state.winnerSide = target.role === 'murderer' ? 'witnesses' : 'murderers';
  state.phase = 'result';
  applyScores(state);
}

function handleKeepCard(state: MatchState, playerId: string, keepIndex: 0 | 1): EngineResult {
  if (state.phase !== 'role_assignment') {
    return fail(state, 'Not in role assignment');
  }
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) {
    return fail(state, 'Not your turn to keep a card');
  }
  if (player.hand.length !== 2) {
    return fail(state, 'You must hold exactly two cards');
  }
  const keep = player.hand[keepIndex];
  const pass = player.hand[1 - keepIndex];
  if (!keep || !pass) {
    return fail(state, 'Invalid keep index');
  }
  player.role = keep;
  player.hand = [];
  player.passedCard = pass;

  const nextSeat = state.currentSeat + 1;
  if (nextSeat >= state.players.length) {
    state.guestRoomCard = pass;
    state.pendingPassToGuest = null;
    beginInformation(state);
  } else {
    state.currentSeat = nextSeat;
    const next = state.players[nextSeat]!;
    next.hand = [pass];
    dealDrawToCurrent(state);
  }
  return ok(state);
}

function handleSighting(
  state: MatchState,
  playerId: string,
  claimedRole: RoleId,
  claimedThroughPlayerId: string,
): EngineResult {
  if (state.phase !== 'information') {
    return fail(state, 'Not in information phase');
  }
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) {
    return fail(state, 'Not your turn to announce');
  }
  if (player.hasAnnounced) {
    return fail(state, 'Already announced');
  }
  if (!playerById(state, claimedThroughPlayerId)) {
    return fail(state, 'Invalid sighting target');
  }
  state.sightings.push({
    fromPlayerId: playerId,
    claimedRole,
    claimedThroughPlayerId,
    isPublic: true,
  });
  player.hasAnnounced = true;
  return ok(state);
}

function advanceInformationSeat(state: MatchState, now: number): void {
  // After announce (+ optional ability), move on when announced and (ability used or skipped)
  const player = currentPlayer(state);
  if (!player?.hasAnnounced) return;
  // Allow ability same turn; advance when they used/skipped ability OR we treat announce-only as needing skip
  // Rule: after announce, they must use or skip ability before advance — enforced by caller for ability actions.
  if (!player.abilityUsed && player.hasAnnounced) {
    // wait for ability or skip — unless they have no role ability worth using; still require skip
    return;
  }
  const next = state.currentSeat + 1;
  if (next >= state.players.length) {
    beginDiscussion(state, now);
  } else {
    state.currentSeat = next;
  }
}

function ensureAnnounced(state: MatchState, playerId: string): EngineResult | null {
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) {
    return fail(state, 'Not your turn');
  }
  if (!player.hasAnnounced) {
    return fail(state, 'Announce a sighting first');
  }
  if (player.abilityUsed) {
    return fail(state, 'Ability already resolved this round');
  }
  return null;
}

function finishAbility(state: MatchState, playerId: string, now: number): EngineResult {
  const player = playerById(state, playerId);
  if (!player) return fail(state, 'Unknown player');
  player.abilityUsed = true;
  advanceInformationSeat(state, now);
  return ok(state);
}

export function applyAction(
  input: MatchState,
  playerId: string,
  action: Action,
  now = Date.now(),
): EngineResult {
  const state = cloneState(input);

  if (state.phase === 'result' || state.phase === 'lobby') {
    return fail(state, 'Match not accepting actions');
  }

  switch (action.type) {
    case 'keep_card':
      return handleKeepCard(state, playerId, action.keepIndex);

    case 'announce_sighting': {
      const result = handleSighting(
        state,
        playerId,
        action.claimedRole,
        action.claimedThroughPlayerId,
      );
      if (!result.ok) return result;
      // Do not auto-advance; wait for ability/skip
      return ok(state);
    }

    case 'skip_ability': {
      if (state.phase !== 'information') return fail(state, 'Not in information phase');
      const err = ensureAnnounced(state, playerId);
      if (err) return err;
      return finishAbility(state, playerId, now);
    }

    case 'use_doctor': {
      if (state.phase !== 'information') return fail(state, 'Not in information phase');
      const err = ensureAnnounced(state, playerId);
      if (err) return err;
      const actor = playerById(state, playerId)!;
      if (actor.role !== 'doctor') return fail(state, 'Only Doctor can use this');
      const target = playerById(state, action.targetPlayerId);
      if (!target?.role) return fail(state, 'Invalid target');
      const isMurderer = target.role === 'murderer';
      state.doctorResults[playerId] = { targetPlayerId: target.id, isMurderer };
      state.abilityReveals.push({
        kind: 'doctor',
        actorPlayerId: playerId,
        targetPlayerId: target.id,
        summary: `${actor.name} examined a player.`,
        privateTo: playerId,
      });
      return finishAbility(state, playerId, now);
    }

    case 'use_detective': {
      if (state.phase !== 'information') return fail(state, 'Not in information phase');
      const err = ensureAnnounced(state, playerId);
      if (err) return err;
      const actor = playerById(state, playerId)!;
      if (actor.role !== 'detective') return fail(state, 'Only Detective can use this');
      const target = playerById(state, action.targetPlayerId);
      if (!target) return fail(state, 'Invalid target');
      if (!target.passedCard) return fail(state, 'No passed card to reveal');
      state.detectiveReveals[playerId] = {
        targetPlayerId: target.id,
        passedCard: target.passedCard,
      };
      state.abilityReveals.push({
        kind: 'detective',
        actorPlayerId: playerId,
        targetPlayerId: target.id,
        summary: `${actor.name} forced a passed-card reveal (private).`,
        privateTo: playerId,
      });
      return finishAbility(state, playerId, now);
    }

    case 'use_spy': {
      if (state.phase !== 'information') return fail(state, 'Not in information phase');
      const err = ensureAnnounced(state, playerId);
      if (err) return err;
      const actor = playerById(state, playerId)!;
      if (actor.role !== 'spy') return fail(state, 'Only Spy can use this');
      if (!state.guestRoomCard) return fail(state, 'Guest Room empty');
      state.spyPeeks[playerId] = state.guestRoomCard;
      state.guestRoomPeeked = true;
      state.abilityReveals.push({
        kind: 'spy',
        actorPlayerId: playerId,
        summary: `${actor.name} peeked at the Guest Room.`,
        privateTo: playerId,
      });
      return finishAbility(state, playerId, now);
    }

    case 'use_priest': {
      if (state.phase !== 'information') return fail(state, 'Not in information phase');
      const err = ensureAnnounced(state, playerId);
      if (err) return err;
      const actor = playerById(state, playerId)!;
      if (actor.role !== 'priest') return fail(state, 'Only Priest can use this');
      const target = playerById(state, action.targetPlayerId);
      if (!target || target.id === playerId) return fail(state, 'Invalid silence target');
      target.isSilenced = true;
      state.abilityReveals.push({
        kind: 'priest',
        actorPlayerId: playerId,
        targetPlayerId: target.id,
        summary: `${actor.name} silenced ${target.name}.`,
      });
      return finishAbility(state, playerId, now);
    }

    case 'chat': {
      if (state.phase !== 'discussion' && state.phase !== 'information') {
        return fail(state, 'Chat not allowed now');
      }
      if (state.variant.speech === 'gestures-only') {
        return fail(state, 'Silent Witness mode: use gestures');
      }
      const speaker = playerById(state, playerId);
      if (!speaker) return fail(state, 'Unknown player');
      if (speaker.isSilenced) return fail(state, 'You are silenced');
      const text = action.text.trim().slice(0, 280);
      if (!text) return fail(state, 'Empty chat');
      state.chat.push({ fromPlayerId: playerId, text, at: now });
      return ok(state);
    }

    case 'gesture': {
      if (state.phase !== 'discussion') return fail(state, 'Gestures only in discussion');
      const speaker = playerById(state, playerId);
      if (!speaker) return fail(state, 'Unknown player');
      state.chat.push({
        fromPlayerId: playerId,
        text: `[gesture:${action.gestureId}]`,
        at: now,
      });
      return ok(state);
    }

    case 'end_discussion': {
      if (state.phase !== 'discussion') return fail(state, 'Not in discussion');
      beginVoting(state);
      return ok(state);
    }

    case 'cast_vote': {
      if (state.phase !== 'voting') return fail(state, 'Not in voting');
      const voter = playerById(state, playerId);
      if (!voter) return fail(state, 'Unknown player');
      if (voter.hasVoted) return fail(state, 'Already voted');
      const target = playerById(state, action.targetPlayerId);
      if (!target) return fail(state, 'Invalid vote target');
      voter.hasVoted = true;
      voter.voteTargetId = target.id;
      state.votes[playerId] = target.id;
      if (state.players.every((p) => p.hasVoted)) {
        resolveVotes(state);
      }
      return ok(state);
    }

    default:
      return fail(state, 'Unknown action');
  }
}
