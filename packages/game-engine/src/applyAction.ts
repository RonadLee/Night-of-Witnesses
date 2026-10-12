import type { Action, RoleId } from '@now/game-types';
import { reasoningSummary } from './ai/decide';
import { dealDrawToCurrent, nextSeatIndex } from './createMatch';
import { createRng, pickRandom } from './rng';
import { teamOf } from './roles';
import { cloneState, pushActivity, type EngineResult, type MatchState } from './state';

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

function roleLabel(role: RoleId): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function beginInformation(state: MatchState, now: number): void {
  state.phase = 'information';
  state.currentSeat = state.variant.passDirection === 'counterclockwise'
    ? state.players.length - 1
    : 0;
  state.phaseEndsAt = now + state.variant.descriptionSeconds * 1000;
  for (const p of state.players) {
    p.status = 'Preparing description';
    p.currentAction = null;
  }
  const cur = state.players[state.currentSeat];
  if (cur) {
    cur.status = 'Describing';
    cur.currentAction = 'Writing a sighting';
  }
  pushActivity(state, 'phase', 'Description phase started.', undefined, now);
}

function beginDiscussion(state: MatchState, now: number): void {
  state.phase = 'discussion';
  state.currentSeat = -1;
  state.phaseEndsAt = now + state.variant.discussionSeconds * 1000;
  for (const p of state.players) {
    p.status = p.isSilenced ? 'Silenced' : 'Discussing';
    p.currentAction = null;
    if (p.isBot && state.aiMinds[p.id]) {
      state.aiMinds[p.id]!.chatBudget =
        state.aiMinds[p.id]!.personality === 'quiet'
          ? 1
          : state.aiMinds[p.id]!.personality === 'aggressive'
            ? 4
            : 2;
    }
  }
  state.nextBotActAt = now + 800;
  pushActivity(state, 'phase', 'Open discussion began.', undefined, now);
}

function beginVoting(state: MatchState, now: number): void {
  state.phase = 'voting';
  state.currentSeat = -1;
  state.phaseEndsAt = now + state.variant.votingSeconds * 1000;
  state.votes = {};
  for (const p of state.players) {
    p.hasVoted = false;
    p.voteTargetId = null;
    p.status = 'Voting';
    p.currentAction = 'Selecting ballot';
  }
  state.nextBotActAt = now + 500;
  pushActivity(state, 'phase', 'Secret voting opened.', undefined, now);
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

function finalizeResult(state: MatchState, now: number): void {
  state.phase = 'result';
  state.phaseEndsAt = null;
  state.aiReasoning = state.players
    .filter((p) => p.isBot)
    .map((p) => ({ playerId: p.id, summary: reasoningSummary(state, p.id) }));
  for (const p of state.players) {
    p.status = p.isLocked ? 'Locked' : 'Finished';
    p.currentAction = null;
  }
  pushActivity(
    state,
    'phase',
    state.winnerSide === 'witnesses' ? 'Witnesses win the round.' : 'Murderer side wins the round.',
    undefined,
    now,
  );
}

function resolveVotes(state: MatchState, now: number): void {
  const tallies = new Map<string, number>();
  const silenced = state.players.find((p) => p.isSilenced);
  for (const [voterId, targetId] of Object.entries(state.votes)) {
    const voter = playerById(state, voterId);
    let weight = 1;
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
  for (const v of tallies.values()) if (v > best) best = v;
  const tied = [...tallies.entries()].filter(([, v]) => v === best).map(([id]) => id);

  if (tied.length === 0) {
    state.winnerSide = 'murderers';
    applyScores(state);
    finalizeResult(state, now);
    return;
  }

  if (tied.length > 1) {
    if (state.revoteCount === 0) {
      state.revoteCount = 1;
      pushActivity(state, 'system', 'Vote tied — one revote.', undefined, now);
      beginVoting(state, now);
      return;
    }
    const rng = createRng(state.seed + state.round * 997 + state.revoteCount);
    lockPlayer(state, pickRandom(tied, rng), now);
    return;
  }

  lockPlayer(state, tied[0]!, now);
}

function lockPlayer(state: MatchState, playerId: string, now: number): void {
  const target = playerById(state, playerId);
  if (!target) {
    state.winnerSide = 'murderers';
    applyScores(state);
    finalizeResult(state, now);
    return;
  }
  target.isLocked = true;
  state.lockedPlayerId = playerId;
  state.winnerSide = target.role === 'murderer' ? 'witnesses' : 'murderers';
  applyScores(state);
  finalizeResult(state, now);
}

function handleKeepCard(
  state: MatchState,
  playerId: string,
  keepIndex: 0 | 1,
  reason: string | undefined,
  now: number,
): EngineResult {
  if (state.phase !== 'role_assignment') return fail(state, 'Not in role assignment');
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return fail(state, 'Not your turn to keep a card');
  if (player.hand.length !== 2) return fail(state, 'You must hold exactly two cards');
  const keep = player.hand[keepIndex];
  const pass = player.hand[1 - keepIndex];
  if (!keep || !pass) return fail(state, 'Invalid keep index');

  player.role = keep;
  player.hand = [];
  player.passedCard = pass;
  player.status = 'Ready';
  player.currentAction = null;

  const keptCount = state.players.filter((p) => p.role !== null).length;
  if (keptCount >= state.players.length) {
    state.guestRoomCard = pass;
    state.passHistory.push({
      fromPlayerId: playerId,
      toPlayerId: 'guest_room',
      role: pass,
      reason,
    });
    pushActivity(
      state,
      'pass',
      `${player.name} completed card selection. Leftover (${roleLabel(pass)}) went to Guest Room.`,
      playerId,
      now,
    );
    beginInformation(state, now);
    return ok(state);
  }

  const next = nextSeatIndex(state, state.currentSeat);
  state.passHistory.push({
    fromPlayerId: playerId,
    toPlayerId: state.players[next]!.id,
    role: pass,
    reason,
  });
  pushActivity(
    state,
    'pass',
    `${player.name} passed ${roleLabel(pass)} card to ${state.players[next]!.name}`,
    playerId,
    now,
  );

  state.currentSeat = next;
  const nextPlayer = state.players[next]!;
  nextPlayer.hand = [pass];
  nextPlayer.status = 'Selecting card';
  nextPlayer.currentAction = 'Choosing which card to keep';
  dealDrawToCurrent(state);
  state.nextBotActAt = now + (nextPlayer.isBot ? 700 : 0);
  return ok(state);
}

function handleSighting(
  state: MatchState,
  playerId: string,
  claimedRole: RoleId,
  claimedThroughPlayerId: string,
  text: string | undefined,
  now: number,
): EngineResult {
  if (state.phase !== 'information') return fail(state, 'Not in information phase');
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return fail(state, 'Not your turn to announce');
  if (player.hasAnnounced) return fail(state, 'Already announced');
  const through = playerById(state, claimedThroughPlayerId);
  if (!through) return fail(state, 'Invalid sighting target');

  const message =
    text?.trim() ||
    `I saw the ${roleLabel(claimedRole)} card pass through ${through.name}`;

  state.sightings.push({
    fromPlayerId: playerId,
    claimedRole,
    claimedThroughPlayerId,
    isPublic: true,
    text: message,
  });
  player.hasAnnounced = true;
  player.status = 'Described';
  player.currentAction = 'Considering ability';
  pushActivity(state, 'sighting', `${player.name}: ${message}`, playerId, now);
  return ok(state);
}

function advanceInformationSeat(state: MatchState, now: number): void {
  const player = currentPlayer(state);
  if (!player?.hasAnnounced || !player.abilityUsed) return;
  player.status = 'Waiting';
  player.currentAction = null;

  let seat = state.currentSeat;
  for (let i = 0; i < state.players.length; i++) {
    seat = nextSeatIndex(state, seat);
    const cand = state.players[seat]!;
    if (!cand.hasAnnounced) {
      state.currentSeat = seat;
      cand.status = 'Describing';
      cand.currentAction = 'Writing a sighting';
      state.nextBotActAt = now + (cand.isBot ? 650 : 0);
      return;
    }
  }
  beginDiscussion(state, now);
}

function ensureAnnounced(state: MatchState, playerId: string): EngineResult | null {
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return fail(state, 'Not your turn');
  if (!player.hasAnnounced) return fail(state, 'Announce a sighting first');
  if (player.abilityUsed) return fail(state, 'Ability already resolved this round');
  return null;
}

function finishAbility(state: MatchState, playerId: string, now: number): EngineResult {
  const player = playerById(state, playerId);
  if (!player) return fail(state, 'Unknown player');
  player.abilityUsed = true;
  player.currentAction = null;
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
      return handleKeepCard(state, playerId, action.keepIndex, action.passReason, now);

    case 'announce_sighting': {
      const result = handleSighting(
        state,
        playerId,
        action.claimedRole,
        action.claimedThroughPlayerId,
        action.text,
        now,
      );
      if (!result.ok) return result;
      return ok(state);
    }

    case 'skip_ability': {
      if (state.phase !== 'information') return fail(state, 'Not in information phase');
      const err = ensureAnnounced(state, playerId);
      if (err) return err;
      pushActivity(state, 'ability', `${playerById(state, playerId)?.name} skipped an ability.`, playerId, now);
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
      state.doctorResults[playerId] = {
        targetPlayerId: target.id,
        isMurderer: target.role === 'murderer',
      };
      state.abilityReveals.push({
        kind: 'doctor',
        actorPlayerId: playerId,
        targetPlayerId: target.id,
        summary: `${actor.name} examined a player.`,
        privateTo: playerId,
      });
      pushActivity(state, 'ability', `${actor.name} used Doctor.`, playerId, now);
      return finishAbility(state, playerId, now);
    }

    case 'use_detective': {
      if (state.phase !== 'information') return fail(state, 'Not in information phase');
      const err = ensureAnnounced(state, playerId);
      if (err) return err;
      const actor = playerById(state, playerId)!;
      if (actor.role !== 'detective') return fail(state, 'Only Detective can use this');
      const target = playerById(state, action.targetPlayerId);
      if (!target?.passedCard) return fail(state, 'No passed card to reveal');
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
      pushActivity(state, 'ability', `${actor.name} used Detective.`, playerId, now);
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
      pushActivity(state, 'ability', `${actor.name} peeked Guest Room.`, playerId, now);
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
      pushActivity(state, 'ability', `${actor.name} silenced ${target.name}.`, playerId, now);
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
      speaker.currentAction = 'Speaking';
      pushActivity(state, 'chat', `${speaker.name}: ${text}`, playerId, now);
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
      pushActivity(state, 'chat', `${speaker.name} gestured (${action.gestureId}).`, playerId, now);
      return ok(state);
    }

    case 'end_discussion': {
      if (state.phase !== 'discussion') return fail(state, 'Not in discussion');
      beginVoting(state, now);
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
      voter.status = 'Voted';
      voter.currentAction = null;
      state.votes[playerId] = target.id;
      pushActivity(state, 'vote', `${voter.name} cast a secret ballot.`, playerId, now);
      if (state.players.every((p) => p.hasVoted)) {
        resolveVotes(state, now);
      }
      return ok(state);
    }

    default:
      return fail(state, 'Unknown action');
  }
}

/** Force unresolved voters when voting timer expires. */
export function forceExpireVoting(state: MatchState, now: number): MatchState {
  const next = cloneState(state);
  if (next.phase !== 'voting') return next;
  for (const p of next.players) {
    if (p.hasVoted) continue;
    const others = next.players.filter((o) => o.id !== p.id);
    const pick = others[Math.floor(createRng(next.seed + p.seatIndex)() * others.length)];
    if (!pick) continue;
    const result = applyAction(next, p.id, { type: 'cast_vote', targetPlayerId: pick.id }, now);
    if (result.ok) Object.assign(next, result.state);
  }
  if (next.phase === 'voting') resolveVotes(next, now);
  return next;
}

/** Skip remaining description turns when timer expires. */
export function forceExpireInformation(state: MatchState, now: number): MatchState {
  let current = cloneState(state);
  if (current.phase !== 'information') return current;
  let guard = 0;
  while (current.phase === 'information' && guard++ < 40) {
    const cur = current.players[current.currentSeat];
    if (!cur) break;
    if (!cur.hasAnnounced) {
      const others = current.players.filter((p) => p.id !== cur.id);
      const through = others[0];
      if (!through) break;
      const r = applyAction(
        current,
        cur.id,
        {
          type: 'announce_sighting',
          claimedRole: 'doctor',
          claimedThroughPlayerId: through.id,
          text: `${cur.name} rushed a vague sighting.`,
        },
        now,
      );
      current = r.state;
    }
    if (current.phase !== 'information') break;
    const still = current.players[current.currentSeat];
    if (still && !still.abilityUsed) {
      const r = applyAction(current, still.id, { type: 'skip_ability' }, now);
      current = r.state;
    }
  }
  return current;
}
