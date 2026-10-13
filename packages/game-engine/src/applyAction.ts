import type { Action, RoleId } from '@now/game-types';
import { reasoningSummary } from './ai/decide';
import { assignTicketsForRole, dealDrawToCurrent, nextSeatIndex } from './createMatch';
import { createRng, pickRandom } from './rng';
import { computeTickets, isGuestRole, resolvePrivateRoomOutcome, teamOf } from './roles';
import { cloneState, pushActivity, type EngineResult, type MatchState } from './state';

const MAX_ABILITY_CHAIN = 6;

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
  state.currentSeat =
    state.variant.passDirection === 'counterclockwise' ? state.players.length - 1 : 0;
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
  pushActivity(state, 'phase', 'Secret voting for Private Room opened.', undefined, now);
}

function applyScores(state: MatchState): void {
  if (state.winnerSide === 'guest_side') {
    for (const p of state.players) {
      if (!p.role) continue;
      if (teamOf(p.role) === 'guest_side' || teamOf(p.role) === 'neutral') {
        state.scores[p.id] = (state.scores[p.id] ?? 0) + 2 + (p.tickets ?? 0);
      }
    }
  } else if (state.winnerSide === 'murderer_side') {
    for (const p of state.players) {
      if (p.role && teamOf(p.role) === 'murderer_side') {
        state.scores[p.id] = (state.scores[p.id] ?? 0) + 3;
      }
    }
  } else if (state.winnerSide === 'bomber') {
    for (const p of state.players) {
      if (p.role === 'bomber') {
        state.scores[p.id] = (state.scores[p.id] ?? 0) + 5;
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
    p.status = p.isLocked ? 'In Private Room' : 'Finished';
    p.currentAction = null;
  }
  const msg =
    state.winnerSide === 'guest_side'
      ? 'Guest side wins — Murderer entered the Private Room.'
      : state.winnerSide === 'murderer_side'
        ? 'Murderer side wins — Murderer avoided the Private Room.'
        : state.winnerSide === 'bomber'
          ? 'Bomber wins alone — Bomber entered the Private Room.'
          : 'Round ended with no winner.';
  pushActivity(state, 'phase', msg, undefined, now);
}

/** Send a player into 爆鎖室 and resolve win conditions + tickets. */
function enterPrivateRoom(state: MatchState, playerId: string, now: number, via: string): void {
  const target = playerById(state, playerId);
  if (!target) {
    state.winnerSide = 'none';
    finalizeResult(state, now);
    return;
  }
  target.isLocked = true;
  state.lockedPlayerId = playerId;
  state.privateRoomPlayerId = playerId;
  pushActivity(
    state,
    'system',
    `${target.name} entered the Private Room (爆鎖室) via ${via}.`,
    undefined,
    now,
  );

  // Butler whitening applies silently when Murderer enters
  if (target.role === 'murderer' && state.butlerWhitenedPlayerIds.length > 0) {
    pushActivity(
      state,
      'system',
      'Butler effect: revealed guests lose color identity at scoring (silent).',
      undefined,
      now,
    );
  }

  const outcome = resolvePrivateRoomOutcome(state);
  state.winnerSide = outcome.winnerSide;
  state.winningRoleIds = outcome.winningRoleIds;
  state.ticketBreakdown = outcome.ticketBreakdown;
  applyScores(state);
  finalizeResult(state, now);
}

/**
 * Execute a player's special ability as part of Detective chain.
 * Returns true if the match already ended (e.g. nested Private Room — should not happen).
 */
function executeChainedAbility(
  state: MatchState,
  playerId: string,
  now: number,
  chain: Set<string>,
): void {
  if (chain.has(playerId) || state.abilityChainDepth >= MAX_ABILITY_CHAIN) return;
  chain.add(playerId);
  state.abilityChainDepth += 1;
  const actor = playerById(state, playerId);
  if (!actor?.role) return;

  if (actor.role === 'butler') {
    const guests = state.players.filter((p) => p.id !== playerId && isGuestRole(p.role));
    const picks = guests.slice(0, 2);
    if (picks.length >= 1) {
      state.butlerPeeks[playerId] = picks.map((g) => ({ playerId: g.id, role: g.role! }));
      state.butlerWhitenedPlayerIds = [
        ...new Set([...state.butlerWhitenedPlayerIds, ...picks.map((g) => g.id)]),
      ];
      state.abilityReveals.push({
        kind: 'butler',
        actorPlayerId: playerId,
        summary: `${actor.name} (chained) secretly viewed guests.`,
        privateTo: playerId,
      });
    }
  } else if (actor.role === 'lawyer') {
    const others = state.players.filter((p) => p.id !== playerId);
    const pick = others[0];
    if (pick && !state.lawyerTargetId) {
      state.lawyerTargetId = pick.id;
      state.abilityReveals.push({
        kind: 'lawyer',
        actorPlayerId: playerId,
        targetPlayerId: pick.id,
        summary: `${actor.name} (chained) marked a ticket invalid.`,
      });
    }
  } else if (actor.role === 'detective' && state.abilityChainDepth < MAX_ABILITY_CHAIN) {
    // Nested detective: pick someone else not in chain
    const cand = state.players.find(
      (p) => p.id !== playerId && !chain.has(p.id) && !p.isLocked,
    );
    if (cand) {
      // Only execute ability of cand, do not nest another private room send mid-chain
      executeChainedAbility(state, cand.id, now, chain);
    }
  }
  // merchant / guests / murderer / accomplice / bomber: no further active ability
}

function resolveVotes(state: MatchState, now: number): void {
  const tallies = new Map<string, number>();
  for (const [voterId, targetId] of Object.entries(state.votes)) {
    const voter = playerById(state, voterId);
    const weight = Math.max(1, voter?.tickets ?? 1);
    tallies.set(targetId, (tallies.get(targetId) ?? 0) + weight);
  }

  let best = 0;
  for (const v of tallies.values()) if (v > best) best = v;
  const tied = [...tallies.entries()].filter(([, v]) => v === best).map(([id]) => id);

  if (tied.length === 0) {
    // No votes — Murderer avoided by default
    state.winnerSide = 'murderer_side';
    state.winningRoleIds = ['murderer'];
    if (state.players.some((p) => p.role === 'accomplice')) state.winningRoleIds.push('accomplice');
    state.ticketBreakdown = computeTickets(state, false);
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
    enterPrivateRoom(state, pickRandom(tied, rng), now, 'tied vote');
    return;
  }

  enterPrivateRoom(state, tied[0]!, now, 'majority vote');
}

function handleKeepCard(
  state: MatchState,
  playerId: string,
  keepIndex: 0 | 1,
  reason: string | undefined,
  claimedRoleInput: RoleId | undefined,
  now: number,
): EngineResult {
  if (state.phase !== 'role_assignment') return fail(state, 'Not in role assignment');
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return fail(state, 'Not your turn to keep a card');
  if (player.hand.length !== 2) return fail(state, 'You must hold exactly two cards');
  const keep = player.hand[keepIndex];
  const pass = player.hand[1 - keepIndex];
  if (!keep || !pass) return fail(state, 'Invalid keep index');

  // Backward compatible: omitted claim = tell the truth
  const claimedRole = claimedRoleInput ?? pass;
  const safeReason = reason?.trim().slice(0, 280) || undefined;

  player.role = keep;
  player.hand = [];
  player.passedCard = pass;
  player.tickets = 1; // updated below
  assignTicketsForRole(state, playerId);
  player.status = 'Ready';
  player.currentAction = null;

  const keptCount = state.players.filter((p) => p.role !== null).length;
  if (keptCount >= state.players.length) {
    state.guestRoomCard = pass;
    state.passHistory.push({
      fromPlayerId: playerId,
      toPlayerId: 'guest_room',
      actualRole: pass,
      claimedRole,
      reason: safeReason,
    });
    state.lastPassAnimation = {
      fromPlayerId: playerId,
      toPlayerId: 'guest_room',
      claimedRole,
      at: now,
    };
    pushActivity(
      state,
      'pass',
      `${player.name} claimed to leave ${roleLabel(claimedRole)} in the Guest Room.`,
      playerId,
      now,
      { claimedRole, toPlayerId: 'guest_room' },
    );
    beginInformation(state, now);
    return ok(state);
  }

  const next = nextSeatIndex(state, state.currentSeat);
  const recipient = state.players[next]!;
  state.passHistory.push({
    fromPlayerId: playerId,
    toPlayerId: recipient.id,
    actualRole: pass,
    claimedRole,
    reason: safeReason,
  });
  state.lastPassAnimation = {
    fromPlayerId: playerId,
    toPlayerId: recipient.id,
    claimedRole,
    at: now,
  };
  pushActivity(
    state,
    'pass',
    `${player.name} claimed to pass ${roleLabel(claimedRole)} to ${recipient.name}.`,
    playerId,
    now,
    { claimedRole, toPlayerId: recipient.id },
  );

  state.currentSeat = next;
  recipient.hand = [pass];
  recipient.status = 'Selecting card';
  recipient.currentAction = 'Choosing which card to keep';
  dealDrawToCurrent(state);
  state.nextBotActAt = now + (recipient.isBot ? 700 : 0);
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

  const message = (
    text?.trim() ||
    `I saw the ${roleLabel(claimedRole)} card pass through ${through.name}`
  ).slice(0, 280);

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

function handleButler(
  state: MatchState,
  playerId: string,
  targetA: string,
  targetB: string,
  now: number,
): EngineResult {
  if (state.phase !== 'information') return fail(state, 'Not in information phase');
  const err = ensureAnnounced(state, playerId);
  if (err) return err;
  const actor = playerById(state, playerId)!;
  if (actor.role !== 'butler') return fail(state, 'Only Butler can use this');
  if (targetA === targetB) return fail(state, 'Choose two different guests');
  const a = playerById(state, targetA);
  const b = playerById(state, targetB);
  if (!a?.role || !b?.role) return fail(state, 'Invalid targets');
  if (!isGuestRole(a.role) || !isGuestRole(b.role)) {
    // Generic error — do not confirm whether targets are non-guests
    return fail(state, 'Invalid targets');
  }

  state.butlerPeeks[playerId] = [
    { playerId: a.id, role: a.role },
    { playerId: b.id, role: b.role },
  ];
  // Silent whitening flag — targets are NOT notified
  state.butlerWhitenedPlayerIds = [
    ...new Set([...state.butlerWhitenedPlayerIds, a.id, b.id]),
  ];
  state.abilityReveals.push({
    kind: 'butler',
    actorPlayerId: playerId,
    summary: `${actor.name} secretly viewed two guests.`,
    privateTo: playerId,
  });
  pushActivity(state, 'ability', `${actor.name} used a private ability.`, playerId, now);
  return finishAbility(state, playerId, now);
}

function handleLawyer(
  state: MatchState,
  playerId: string,
  targetPlayerId: string,
  now: number,
): EngineResult {
  if (state.phase !== 'information') return fail(state, 'Not in information phase');
  const err = ensureAnnounced(state, playerId);
  if (err) return err;
  const actor = playerById(state, playerId)!;
  if (actor.role !== 'lawyer') return fail(state, 'Only Lawyer can use this');
  const target = playerById(state, targetPlayerId);
  if (!target || target.id === playerId) return fail(state, 'Invalid lawyer target');
  state.lawyerTargetId = target.id;
  state.abilityReveals.push({
    kind: 'lawyer',
    actorPlayerId: playerId,
    targetPlayerId: target.id,
    summary: `${actor.name} marked a player's ticket for invalidation.`,
    privateTo: playerId,
  });
  pushActivity(state, 'ability', `${actor.name} used a private ability.`, playerId, now);
  return finishAbility(state, playerId, now);
}

function handleDetective(
  state: MatchState,
  playerId: string,
  targetPlayerId: string,
  now: number,
): EngineResult {
  // Allowed in information (after announce) or discussion (reveal + sudden resolution)
  if (state.phase !== 'information' && state.phase !== 'discussion') {
    return fail(state, 'Detective ability not available now');
  }
  const actor = playerById(state, playerId);
  if (!actor || actor.role !== 'detective') return fail(state, 'Only Detective can use this');
  if (actor.abilityUsed) return fail(state, 'Ability already used');

  if (state.phase === 'information') {
    const err = ensureAnnounced(state, playerId);
    if (err) return err;
  }

  const target = playerById(state, targetPlayerId);
  if (!target || target.id === playerId) return fail(state, 'Invalid detective target');

  actor.abilityUsed = true;
  actor.roleRevealed = true;
  state.abilityReveals.push({
    kind: 'detective',
    actorPlayerId: playerId,
    targetPlayerId: target.id,
    summary: `${actor.name} revealed Detective and sent ${target.name} to the Private Room.`,
  });
  pushActivity(
    state,
    'ability',
    `${actor.name} (Detective) sent ${target.name} into the Private Room.`,
    playerId,
    now,
  );

  if (target.role === 'murderer') {
    const guests = state.players.filter((p) => isGuestRole(p.role));
    const rng = createRng(state.seed + now);
    const revealed = guests.length ? pickRandom(guests, rng) : null;
    if (revealed?.role) {
      revealed.roleRevealed = true;
      state.detectiveNote = `Murderer confirmed. Guest revealed: ${revealed.name} is ${roleLabel(revealed.role)}.`;
      state.abilityReveals.push({
        kind: 'system',
        actorPlayerId: playerId,
        targetPlayerId: revealed.id,
        summary: state.detectiveNote,
      });
      pushActivity(state, 'ability', state.detectiveNote, playerId, now);
    }
  } else {
    state.abilityChainDepth = 0;
    executeChainedAbility(state, target.id, now, new Set([playerId]));
    state.detectiveNote = `Target was not Murderer — executed ${roleLabel(target.role ?? 'guest_yellow')} ability.`;
  }

  enterPrivateRoom(state, target.id, now, 'Detective');
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
      return handleKeepCard(
        state,
        playerId,
        action.keepIndex,
        action.passReason,
        action.claimedRole,
        now,
      );

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
      pushActivity(
        state,
        'ability',
        `${playerById(state, playerId)?.name} skipped an ability.`,
        playerId,
        now,
      );
      return finishAbility(state, playerId, now);
    }

    case 'use_butler':
      return handleButler(state, playerId, action.targetA, action.targetB, now);

    case 'use_lawyer':
      return handleLawyer(state, playerId, action.targetPlayerId, now);

    case 'use_detective':
      return handleDetective(state, playerId, action.targetPlayerId, now);

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
          claimedRole: 'guest_yellow',
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
