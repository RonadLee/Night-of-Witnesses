import type { BoilerRole, RoundSummary, TableAction } from '@now/game-types';
import { createRng, pickRandom } from '../rng';
import { assertTable, cardLabel, createTableMatch } from './createTable';
import { PASS_TURN_MS } from './settings';
import { cleanEmoji, cleanText } from './text';
import {
  cloneTable,
  type Ballot,
  type TableEngineResult,
  type TablePlayer,
  type TableResolution,
  type TableState,
} from './state';

function fail(state: TableState, error: string): TableEngineResult {
  return { ok: false, error, state };
}

function success(state: TableState, effect: 'return_lobby' | 'end_game' | null = null): TableEngineResult {
  return { ok: true, state, effect };
}

function playerById(state: TableState, id: string): TablePlayer | undefined {
  return state.players.find((p) => p.id === id);
}

function playerBySeat(state: TableState, seat: number): TablePlayer | undefined {
  return state.players.find((p) => p.seatIndex === seat);
}

function pushActivity(
  state: TableState,
  kind: TableState['activity'][number]['kind'],
  text: string,
  now: number,
) {
  state.seq += 1;
  state.activity.push({ id: `a${state.seq}`, at: now, kind, text });
  if (state.activity.length > 200) state.activity.splice(0, state.activity.length - 200);
}

function nonceKey(playerId: string, type: string): string {
  return `${playerId}:${type}`;
}

export interface ExpectedTarget {
  kind: 'player' | 'unseated';
  player?: TablePlayer;
}

export function expectedTarget(state: TableState): ExpectedTarget | null {
  if (state.phase !== 'passing') return null;
  const nextSeat = state.passOrder[state.passCursor + 1];
  if (nextSeat === undefined) return { kind: 'unseated' };
  const player = playerBySeat(state, nextSeat);
  if (!player) return null;
  return { kind: 'player', player };
}

function rememberNonce(state: TableState, playerId: string, action: TableAction) {
  if (action.nonce) state.nonces[nonceKey(playerId, action.type)] = action.nonce;
}

function withinRate(
  bucket: Record<string, number[]>,
  playerId: string,
  now: number,
  limit: number,
  windowMs: number,
): boolean {
  const recent = (bucket[playerId] ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    bucket[playerId] = recent;
    return false;
  }
  recent.push(now);
  bucket[playerId] = recent;
  return true;
}

function beginDescription(state: TableState, now: number) {
  state.phase = 'description';
  state.descriptionCursor = 0;
  state.currentSeat = state.players[0]?.seatIndex ?? 0;
  state.phaseEndsAt = now + state.settings.descriptionSeconds * 1000;
  pushActivity(state, 'phase', 'Individual descriptions have started.', now);
}

function advanceDescription(state: TableState, now: number) {
  const next = state.descriptionCursor + 1;
  if (next >= state.players.length) {
    beginDiscussion(state, now);
    return;
  }
  state.descriptionCursor = next;
  state.currentSeat = state.players[next]!.seatIndex;
  state.phaseEndsAt = now + state.settings.descriptionSeconds * 1000;
}

function beginDiscussion(state: TableState, now: number) {
  state.phase = 'discussion';
  state.currentSeat = -1;
  state.phaseEndsAt = now + state.settings.discussionSeconds * 1000;
  pushActivity(state, 'phase', 'Group discussion has started.', now);
}

function beginVoting(state: TableState, now: number) {
  state.phase = 'voting';
  state.currentSeat = -1;
  state.revoteCount = 0;
  state.phaseEndsAt = now + state.settings.votingSeconds * 1000;
  for (const p of state.players) {
    p.hasVoted = false;
    p.voteTargetId = null;
  }
  pushActivity(state, 'phase', 'Voting phase has started.', now);
}

function freshVote(state: TableState, now: number) {
  state.phase = 'voting';
  state.currentSeat = -1;
  state.phaseEndsAt = now + state.settings.votingSeconds * 1000;
  for (const p of state.players) {
    p.hasVoted = false;
    p.voteTargetId = null;
  }
  pushActivity(state, 'vote', 'The vote was tied. A revote has started.', now);
}

function nameOf(state: TableState, id: string | null): string {
  if (!id) return 'the unseated pile';
  return playerById(state, id)?.name ?? 'a player';
}

function performPass(
  state: TableState,
  playerId: string,
  passIndex: 0 | 1,
  targetPlayerId: string,
  now: number,
  system: boolean,
): TableEngineResult {
  if (state.phase !== 'passing') return fail(state, 'Passing is closed');
  const player = playerBySeat(state, state.currentSeat);
  if (!player || player.id !== playerId) return fail(state, 'Not your turn to pass');
  if (player.hand.length !== 2) return fail(state, 'You must hold exactly two cards');
  if (passIndex !== 0 && passIndex !== 1) return fail(state, 'Invalid card');
  const target = expectedTarget(state);
  if (!target) return fail(state, 'No legal pass target');
  if (target.kind === 'unseated') {
    if (targetPlayerId !== 'unseated') return fail(state, 'That card must be set aside');
  } else if (!target.player || target.player.id !== targetPlayerId) {
    return fail(state, 'You cannot pass to that player');
  } else if (!system && !target.player.connected) {
    return fail(state, 'That player is unavailable');
  } else if (!state.deck[0]) {
    return fail(state, 'The deck ran out of cards');
  }

  const card = player.hand[passIndex]!;
  const keep = player.hand[1 - passIndex]!;
  player.role = keep;
  player.hand = [];
  player.passedCard = card;
  const toId = target.kind === 'unseated' ? null : target.player!.id;
  state.passes.push({ fromPlayerId: player.id, toPlayerId: toId, card, at: now });
  const auto = system ? 'Time expired. ' : '';
  pushActivity(
    state,
    'pass',
    `${auto}${cardLabel(card)} passed from ${player.name} to ${nameOf(state, toId)}.`,
    now,
  );

  if (target.kind === 'unseated') {
    state.unseatedCard = card;
    state.currentSeat = -1;
    beginDescription(state, now);
    assertTable(state);
    return success(state);
  }

  const drawn = state.deck.shift();
  if (!drawn) return fail(state, 'The deck ran out of cards');
  target.player!.hand = [card, drawn];
  state.passCursor += 1;
  state.currentSeat = target.player!.seatIndex;
  state.phaseEndsAt = now + PASS_TURN_MS;
  assertTable(state);
  return success(state);
}

function submitDescription(
  state: TableState,
  playerId: string,
  text: string,
  now: number,
  system: boolean,
): TableEngineResult {
  if (state.phase !== 'description') return fail(state, 'Descriptions are closed');
  const player = playerBySeat(state, state.currentSeat);
  if (!player || player.id !== playerId) return fail(state, 'Only the active player can speak');
  if (player.description !== null) return fail(state, 'Description already submitted');
  const clean = cleanText(text || player.draft, 500);
  player.description = clean;
  player.draft = clean;
  pushActivity(
    state,
    'system',
    system
      ? `Time expired. ${player.name}'s description was saved.`
      : `${player.name} completed their description.`,
    now,
  );
  advanceDescription(state, now);
  return success(state);
}

function weightFor(player: TablePlayer): number {
  return player.role === 'merchant' ? 2 : 1;
}

function buildResolution(state: TableState): TableResolution {
  const lawyer = state.players.find((p) => p.role === 'lawyer');
  const invalidatedId = lawyer?.voteTargetId ?? null;
  const ballots: Ballot[] = [];
  const totals: Record<string, number> = {};
  for (const player of state.players) {
    if (!player.hasVoted || !player.voteTargetId || !player.canVote) continue;
    const invalidated = player.id === invalidatedId;
    const weight = invalidated ? 0 : weightFor(player);
    ballots.push({
      voterId: player.id,
      targetId: player.voteTargetId,
      weight,
      invalidated,
    });
    if (weight > 0) totals[player.voteTargetId] = (totals[player.voteTargetId] ?? 0) + weight;
  }
  const notes: string[] = [];
  const merchant = state.players.find((p) => p.role === 'merchant' && p.hasVoted);
  if (merchant) notes.push(`${merchant.name} is the Merchant. Their ballot counts as 2.`);
  if (lawyer?.voteTargetId) {
    notes.push(
      `${lawyer.name} is the Lawyer. ${nameOf(state, lawyer.voteTargetId)}'s ballot is invalidated.`,
    );
  }
  if (state.departedPublic) {
    const who = state.players.find((p) => p.role === 'butler');
    if (who) notes.push(`${who.name} revealed the Butler and lost their vote.`);
  }
  return { voteTotals: totals, ballots, abilityNotes: notes };
}

function awardGuests(state: TableState) {
  for (const p of state.players) {
    if (!p.role || p.role === 'murderer' || p.role === 'accomplice' || p.role === 'bomber') continue;
    state.scores[p.id] = (state.scores[p.id] ?? 0) + 2;
  }
}

function awardMurderers(state: TableState) {
  for (const p of state.players) {
    if (p.role === 'murderer' || p.role === 'accomplice') {
      state.scores[p.id] = (state.scores[p.id] ?? 0) + 3;
    }
  }
}

function lockAndScore(state: TableState, lockedId: string | null, now: number) {
  const locked = lockedId ? playerById(state, lockedId) : undefined;
  state.lockedPlayerId = locked?.id ?? null;
  state.resolution = buildResolution(state);

  if (locked?.role === 'bomber') {
    state.winner = 'bomber';
    state.scores[locked.id] = (state.scores[locked.id] ?? 0) + 5;
    pushActivity(
      state,
      'phase',
      `${locked.name} is the Bomber and wins alone. Every other victory is void.`,
      now,
    );
  } else if (locked?.role === 'murderer') {
    state.winner = 'guests';
    awardGuests(state);
    pushActivity(state, 'phase', 'The Murderer entered the Boiler Room. The guests win.', now);
  } else {
    state.winner = 'murderers';
    awardMurderers(state);
    pushActivity(
      state,
      'phase',
      locked
        ? `${locked.name} entered the Boiler Room. The Murderer avoided it and wins.`
        : 'Nobody entered the Boiler Room. The Murderer wins.',
      now,
    );
  }
  state.phase = 'result';
  state.phaseEndsAt = null;
  state.currentSeat = -1;
}

function resolveVotes(state: TableState, now: number): TableState {
  const peeked = buildResolution(state);
  let best = 0;
  for (const value of Object.values(peeked.voteTotals)) {
    if (value > best) best = value;
  }
  const tied = Object.entries(peeked.voteTotals)
    .filter(([, value]) => value === best && value > 0)
    .map(([id]) => id);

  if (tied.length === 0) {
    lockAndScore(state, null, now);
    return state;
  }
  if (tied.length > 1) {
    if (state.revoteCount === 0) {
      state.revoteCount = 1;
      freshVote(state, now);
      return state;
    }
    const rng = createRng(state.seed + state.round * 997 + state.revoteCount);
    lockAndScore(state, pickRandom(tied, rng), now);
    return state;
  }
  lockAndScore(state, tied[0]!, now);
  return state;
}

function votingReady(state: TableState): boolean {
  const eligible = state.players.filter((p) => p.canVote && p.connected);
  if (eligible.length === 0) return true;
  return eligible.every((p) => p.hasVoted);
}

function summarize(state: TableState): RoundSummary {
  const roles: Record<string, BoilerRole> = {};
  for (const p of state.players) {
    if (p.role) roles[p.id] = p.role;
  }
  return {
    round: state.round,
    winner: state.winner ?? 'murderers',
    lockedPlayerId: state.lockedPlayerId,
    roles,
    voteTotals: state.resolution?.voteTotals ?? {},
    passes: state.passes,
    descriptions: state.players
      .filter((p) => p.description !== null)
      .map((p) => ({ playerId: p.id, name: p.name, text: p.description ?? '' })),
  };
}

export function applyTableAction(
  input: TableState,
  playerId: string,
  action: TableAction,
  now = Date.now(),
): TableEngineResult {
  if (action.nonce && input.nonces[nonceKey(playerId, action.type)] === action.nonce) {
    return success(input);
  }
  const state = cloneTable(input);
  const actor = playerById(state, playerId);

  switch (action.type) {
    case 'confirm_pass': {
      const result = performPass(state, playerId, action.passIndex, action.targetPlayerId, now, false);
      if (result.ok) rememberNonce(result.state, playerId, action);
      return result;
    }
    case 'save_draft': {
      if (state.phase !== 'description') return fail(input, 'Descriptions are closed');
      const current = playerBySeat(state, state.currentSeat);
      if (!current || current.id !== playerId) return fail(input, 'Only the active player can write');
      current.draft = cleanText(action.text, 500);
      rememberNonce(state, playerId, action);
      return success(state);
    }
    case 'submit_description': {
      const result = submitDescription(state, playerId, action.text, now, false);
      if (result.ok) rememberNonce(result.state, playerId, action);
      return result;
    }
    case 'chat': {
      if (state.phase !== 'discussion') return fail(input, 'Chat is closed');
      if (!actor) return fail(input, 'Unknown player');
      if (!withinRate(state.chatTimes, playerId, now, 6, 10_000)) {
        return fail(input, 'You are sending messages too quickly');
      }
      const text = cleanText(action.text, 280);
      if (!text) return fail(input, 'Message is empty');
      const prev = state.lastChat[playerId];
      if (prev && prev.text === text && now - prev.at < 3000) {
        return fail(input, 'Please wait before repeating that');
      }
      state.seq += 1;
      state.chat.push({
        id: `c${state.seq}`,
        fromPlayerId: playerId,
        text,
        at: now,
        reactions: [],
      });
      if (state.chat.length > 200) state.chat.splice(0, state.chat.length - 200);
      state.lastChat[playerId] = { text, at: now };
      rememberNonce(state, playerId, action);
      return success(state);
    }
    case 'react': {
      if (state.phase !== 'discussion' && state.phase !== 'result') return fail(input, 'Reactions are closed');
      if (!actor) return fail(input, 'Unknown player');
      const emoji = cleanEmoji(action.emoji);
      if (!emoji) return fail(input, 'That reaction is not allowed');
      if (!withinRate(state.reactionTimes, playerId, now, 10, 10_000)) {
        return fail(input, 'You are reacting too quickly');
      }
      const message = state.chat.find((m) => m.id === action.messageId);
      if (!message) return fail(input, 'Message not found');
      const existing = message.reactions.findIndex((r) => r.playerId === playerId && r.emoji === emoji);
      if (existing >= 0) message.reactions.splice(existing, 1);
      else message.reactions.push({ playerId, emoji });
      rememberNonce(state, playerId, action);
      return success(state);
    }
    case 'butler_reveal': {
      if (state.phase !== 'discussion') return fail(input, 'You can reveal only during discussion');
      if (!actor || actor.role !== 'butler') return fail(input, 'Only the Butler can do that');
      if (state.departedPublic) return fail(input, 'The Butler has already revealed');
      state.departedPublic = true;
      actor.canVote = false;
      pushActivity(
        state,
        'ability',
        `${actor.name} revealed the Butler. The guests who left are ${cardLabel(state.departedGuests[0])} and ${cardLabel(state.departedGuests[1])}. ${actor.name} loses their vote.`,
        now,
      );
      rememberNonce(state, playerId, action);
      return success(state);
    }
    case 'detective_lock': {
      if (state.phase !== 'discussion') return fail(input, 'The Detective can act only during discussion');
      if (!actor || actor.role !== 'detective') return fail(input, 'Only the Detective can do that');
      if (state.detectiveUsed) return fail(input, 'The Detective already acted');
      const target = playerById(state, action.targetPlayerId);
      if (!target) return fail(input, 'That player is not at the table');
      state.detectiveUsed = true;
      pushActivity(
        state,
        'ability',
        `${actor.name} revealed the Detective and sent ${target.name} into the Boiler Room.`,
        now,
      );
      lockAndScore(state, target.id, now);
      rememberNonce(state, playerId, action);
      return success(state);
    }
    case 'cast_vote': {
      if (state.phase !== 'voting') return fail(input, 'Voting is closed');
      if (!actor) return fail(input, 'Unknown player');
      if (!actor.canVote) return fail(input, 'You cannot vote');
      if (actor.hasVoted) return fail(input, 'You already voted');
      const target = playerById(state, action.targetPlayerId);
      if (!target) return fail(input, 'That player is not at the table');
      actor.hasVoted = true;
      actor.voteTargetId = target.id;
      pushActivity(state, 'vote', `${actor.name} has voted.`, now);
      rememberNonce(state, playerId, action);
      if (votingReady(state)) resolveVotes(state, now);
      return success(state);
    }
    case 'next_round': {
      if (playerId !== state.hostPlayerId) return fail(input, 'Only the host can do that');
      if (state.phase !== 'result') return fail(input, 'The round is still in progress');
      if (state.round >= state.settings.rounds) return fail(input, 'That was the last round');
      const created = createTableMatch({
        players: state.players.map((p) => ({
          id: p.id,
          name: p.name,
          seatIndex: p.seatIndex,
          connected: p.connected,
        })),
        settings: state.settings,
        hostPlayerId: state.hostPlayerId,
        seed: state.seed + state.round * 1009,
        now,
        scores: state.scores,
        round: state.round + 1,
        previousRounds: [...state.previousRounds, summarize(state)],
      });
      return success(created);
    }
    case 'return_lobby': {
      if (playerId !== state.hostPlayerId) return fail(input, 'Only the host can do that');
      if (state.phase !== 'result' && state.phase !== 'ended') {
        return fail(input, 'Finish the round before returning to the lobby');
      }
      rememberNonce(state, playerId, action);
      return success(state, 'return_lobby');
    }
    case 'end_game': {
      if (playerId !== state.hostPlayerId) return fail(input, 'Only the host can do that');
      if (state.phase !== 'result' && state.phase !== 'ended') {
        return fail(input, 'Finish the round before ending the game');
      }
      state.phase = 'ended';
      state.phaseEndsAt = null;
      pushActivity(state, 'phase', 'The host ended the game.', now);
      rememberNonce(state, playerId, action);
      return success(state, 'end_game');
    }
    default:
      return fail(input, 'Unknown action');
  }
}

export function tickTable(input: TableState, now: number): TableState {
  if (input.phaseEndsAt === null || now < input.phaseEndsAt) return input;
  if (input.phase === 'passing') {
    const current = playerBySeat(input, input.currentSeat);
    const target = expectedTarget(input);
    if (!current || !target) return input;
    const targetId = target.kind === 'unseated' ? 'unseated' : target.player?.id;
    if (!targetId) return input;
    const result = performPass(cloneTable(input), current.id, 1, targetId, now, true);
    return result.ok ? result.state : input;
  }
  if (input.phase === 'description') {
    const current = playerBySeat(input, input.currentSeat);
    if (!current) return input;
    const result = submitDescription(cloneTable(input), current.id, current.draft, now, true);
    return result.ok ? result.state : input;
  }
  if (input.phase === 'discussion') {
    const state = cloneTable(input);
    beginVoting(state, now);
    return state;
  }
  if (input.phase === 'voting') {
    return resolveVotes(cloneTable(input), now);
  }
  return input;
}

export function setConnected(input: TableState, playerId: string, connected: boolean): TableState {
  const player = input.players.find((p) => p.id === playerId);
  if (!player || player.connected === connected) return input;
  const state = cloneTable(input);
  const next = state.players.find((p) => p.id === playerId);
  if (next) next.connected = connected;
  return state;
}

export function setTyping(input: TableState, playerId: string, typing: boolean): TableState {
  const player = input.players.find((p) => p.id === playerId);
  if (!player || player.typing === typing) return input;
  const state = cloneTable(input);
  const next = state.players.find((p) => p.id === playerId);
  if (next) next.typing = typing;
  return state;
}

export function nudgeTable(input: TableState, now: number): TableState {
  if (input.phase === 'voting' && votingReady(input)) {
    return resolveVotes(cloneTable(input), now);
  }
  return input;
}

export function setHost(input: TableState, hostPlayerId: string): TableState {
  if (input.hostPlayerId === hostPlayerId) return input;
  if (!input.players.some((p) => p.id === hostPlayerId)) return input;
  const state = cloneTable(input);
  state.hostPlayerId = hostPlayerId;
  return state;
}
