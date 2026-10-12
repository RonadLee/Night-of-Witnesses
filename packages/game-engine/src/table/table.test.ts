import { describe, expect, it } from 'vitest';
import type { BoilerRole, TableSettings } from '@now/game-types';
import { applyTableAction, nudgeTable, tickTable } from './applyTable';
import { buildBoilerDeck, createTableMatch } from './createTable';
import { checksumState } from './integrity';
import { getTableView } from './view';
import { sanitizeSettings } from './settings';
import { cleanText } from './text';
import { setConnected } from './applyTable';
import type { TableState } from './state';

function people(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p_${String.fromCharCode(97 + i).repeat(6)}`,
    name: `Player ${i + 1}`,
    seatIndex: i,
    connected: true,
  }));
}

function settings(patch: Partial<TableSettings> = {}): TableSettings {
  return sanitizeSettings({ ...patch });
}

function start(n = 4, patch: Partial<TableSettings> = {}, seed = 7): TableState {
  const seated = people(n);
  return createTableMatch({
    players: seated,
    settings: settings({ maxPlayers: n, ...patch }),
    hostPlayerId: seated[0]!.id,
    seed,
    now: 1_000,
  });
}

function passAll(state: TableState, now = 2_000): TableState {
  let next = state;
  let guard = 0;
  while (next.phase === 'passing' && guard < 20) {
    const current = next.players.find((p) => p.seatIndex === next.currentSeat)!;
    const target = getTableView(next, current.id).private.passTarget!;
    const result = applyTableAction(
      next,
      current.id,
      {
        type: 'confirm_pass',
        passIndex: 0,
        targetPlayerId: target.playerId ?? 'unseated',
      },
      now + guard,
    );
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (result.ok) next = result.state;
    guard += 1;
  }
  return next;
}

function describeAll(state: TableState): TableState {
  let next = state;
  let guard = 0;
  while (next.phase === 'description' && guard < 20) {
    const current = next.players.find((p) => p.seatIndex === next.currentSeat)!;
    const result = applyTableAction(
      next,
      current.id,
      { type: 'submit_description', text: `${current.name} saw a shadow.` },
      5_000 + guard,
    );
    expect(result.ok).toBe(true);
    if (result.ok) next = result.state;
    guard += 1;
  }
  return next;
}

function forceRoles(state: TableState, roles: BoilerRole[]): TableState {
  const next = structuredClone(state);
  roles.forEach((role, i) => {
    next.players[i]!.role = role;
    next.players[i]!.hand = [];
  });
  next.deck = [];
  next.unseatedCard = 'guest_yellow';
  next.phase = 'voting';
  next.currentSeat = -1;
  next.phaseEndsAt = 50_000;
  return next;
}

describe('boiler deck', () => {
  it('deals playerCount+1 cards with one murderer and at least one guest', () => {
    for (const count of [4, 5, 6, 9]) {
      const deck = buildBoilerDeck(count, settings(), () => 0.1);
      expect(deck).toHaveLength(count + 1);
      expect(deck.filter((c) => c === 'murderer')).toHaveLength(1);
      expect(deck.some((c) => c.startsWith('guest_'))).toBe(true);
    }
  });

  it('omits the accomplice below 6 players and specials when disabled', () => {
    const small = buildBoilerDeck(4, settings(), () => 0.2);
    expect(small.includes('accomplice')).toBe(false);
    const plain = buildBoilerDeck(6, settings({ specialCards: false }), () => 0.3);
    expect(plain.filter((c) => c !== 'murderer').every((c) => c.startsWith('guest_'))).toBe(true);
  });

  it('rejects impossible table sizes', () => {
    expect(() => buildBoilerDeck(3, settings(), () => 0.1)).toThrow();
    expect(() => buildBoilerDeck(10, settings(), () => 0.1)).toThrow();
  });
});

describe('passing', () => {
  it('opens with two cards and only lets the current player pass to the next seat', () => {
    const state = start();
    const current = state.players.find((p) => p.seatIndex === state.currentSeat)!;
    const other = state.players.find((p) => p.id !== current.id)!;
    expect(current.hand).toHaveLength(2);
    const bad = applyTableAction(state, other.id, {
      type: 'confirm_pass',
      passIndex: 0,
      targetPlayerId: current.id,
    });
    expect(bad.ok).toBe(false);
    const wrongTarget = applyTableAction(state, current.id, {
      type: 'confirm_pass',
      passIndex: 0,
      targetPlayerId: other.id === getTableView(state, current.id).private.passTarget?.playerId ? 'p_zzzzzz' : other.id,
    });
    expect(wrongTarget.ok).toBe(false);
  });

  it('records the passed card and refuses a second pass from the same player', () => {
    let state = start(4, { passDirection: 'clockwise' }, 3);
    const first = state.players.find((p) => p.seatIndex === state.currentSeat)!;
    const targetId = getTableView(state, first.id).private.passTarget!.playerId!;
    const passed = first.hand[0]!;
    const once = applyTableAction(state, first.id, {
      type: 'confirm_pass',
      passIndex: 0,
      targetPlayerId: targetId,
      nonce: 'n1',
    });
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    state = once.state;
    expect(state.passes[0]).toMatchObject({ fromPlayerId: first.id, toPlayerId: targetId, card: passed });
    expect(state.activity.some((a) => a.text.includes('passed from'))).toBe(true);
    const again = applyTableAction(state, first.id, {
      type: 'confirm_pass',
      passIndex: 0,
      targetPlayerId: targetId,
    });
    expect(again.ok).toBe(false);
    const replay = applyTableAction(state, first.id, {
      type: 'confirm_pass',
      passIndex: 1,
      targetPlayerId: targetId,
      nonce: 'n1',
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.state.passes).toHaveLength(1);
  });

  it('blocks a pass to a disconnected player and still auto-passes when the timer ends', () => {
    let state = start();
    const targetId = getTableView(state, state.players.find((p) => p.seatIndex === state.currentSeat)!.id).private
      .passTarget!.playerId!;
    state = setConnected(state, targetId, false);
    const current = state.players.find((p) => p.seatIndex === state.currentSeat)!;
    const denied = applyTableAction(state, current.id, {
      type: 'confirm_pass',
      passIndex: 0,
      targetPlayerId: targetId,
    });
    expect(denied.ok).toBe(false);
    const auto = tickTable(state, state.phaseEndsAt! + 1);
    expect(auto.passes).toHaveLength(1);
    expect(auto.passes[0]!.toPlayerId).toBe(targetId);
  });

  it('finishes the chain in both directions and enters descriptions', () => {
    for (const passDirection of ['clockwise', 'counter-clockwise', 'random'] as const) {
      const done = passAll(start(5, { passDirection }, 11));
      expect(done.phase).toBe('description');
      expect(done.players.every((p) => p.role)).toBe(true);
      expect(done.unseatedCard).toBeTruthy();
      expect(done.passes).toHaveLength(5);
    }
  });
});

describe('descriptions and discussion', () => {
  it('lets only the active player write, saves drafts, and auto-submits on timeout', () => {
    let state = passAll(start());
    const active = state.players.find((p) => p.seatIndex === state.currentSeat)!;
    const other = state.players.find((p) => p.id !== active.id)!;
    const denied = applyTableAction(state, other.id, { type: 'submit_description', text: 'nope' });
    expect(denied.ok).toBe(false);
    const draft = applyTableAction(state, active.id, { type: 'save_draft', text: 'I kept a quiet card' });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    expect(getTableView(draft.state, active.id).private.draft).toContain('quiet');
    expect(getTableView(draft.state, other.id).private.draft).toBe('');
    const expired = tickTable(draft.state, draft.state.phaseEndsAt! + 5);
    expect(expired.players.find((p) => p.id === active.id)!.description).toContain('quiet');
    expect(expired.descriptionCursor).toBe(1);
  });

  it('opens discussion for everyone and rate-limits chat', () => {
    let state = describeAll(passAll(start()));
    expect(state.phase).toBe('discussion');
    const speaker = state.players[0]!;
    let now = 10_000;
    for (let i = 0; i < 6; i++) {
      const sent = applyTableAction(state, speaker.id, { type: 'chat', text: `note ${i}` }, now + i);
      expect(sent.ok).toBe(true);
      if (sent.ok) state = sent.state;
    }
    const spam = applyTableAction(state, speaker.id, { type: 'chat', text: 'note 7' }, now + 7);
    expect(spam.ok).toBe(false);
    const other = applyTableAction(state, state.players[1]!.id, { type: 'chat', text: 'I disagree' }, now + 8);
    expect(other.ok).toBe(true);
  });

  it('supports butler reveal and detective lock', () => {
    let state = describeAll(passAll(start(4, {}, 4)));
    state.players[0]!.role = 'butler';
    state.players[1]!.role = 'detective';
    state.players[2]!.role = 'murderer';
    state.players[3]!.role = 'guest_red';
    const reveal = applyTableAction(state, state.players[0]!.id, { type: 'butler_reveal' }, 20_000);
    expect(reveal.ok).toBe(true);
    if (!reveal.ok) return;
    expect(reveal.state.departedPublic).toBe(true);
    expect(reveal.state.players[0]!.canVote).toBe(false);
    expect(getTableView(reveal.state, state.players[2]!.id).public.departedGuests).toHaveLength(2);
    const locked = applyTableAction(
      reveal.state,
      state.players[1]!.id,
      { type: 'detective_lock', targetPlayerId: state.players[2]!.id },
      21_000,
    );
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    expect(locked.state.phase).toBe('result');
    expect(locked.state.winner).toBe('guests');
    expect(locked.state.lockedPlayerId).toBe(state.players[2]!.id);
  });
});

describe('voting and results', () => {
  it('counts the merchant as 2 and invalidates the lawyer target', () => {
    let state = forceRoles(start(), ['lawyer', 'merchant', 'murderer', 'guest_blue']);
    const [lawyer, merchant, murderer, guest] = state.players;
    const steps: Array<[string, string]> = [
      [lawyer!.id, merchant!.id],
      [merchant!.id, murderer!.id],
      [murderer!.id, murderer!.id],
      [guest!.id, murderer!.id],
    ];
    for (const [voter, target] of steps) {
      const result = applyTableAction(state, voter, { type: 'cast_vote', targetPlayerId: target }, 300);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.phase).toBe('result');
    expect(state.resolution?.ballots.find((b) => b.voterId === merchant!.id)?.invalidated).toBe(true);
    expect(state.resolution?.ballots.find((b) => b.voterId === guest!.id)?.weight).toBe(1);
    expect(state.lockedPlayerId).toBe(murderer!.id);
    expect(state.winner).toBe('guests');
    expect(state.scores[guest!.id]).toBe(2);
    expect(state.scores[murderer!.id]).toBe(0);
  });

  it('weights a merchant ballot as two votes', () => {
    let state = forceRoles(start(), ['merchant', 'guest_red', 'guest_blue', 'murderer']);
    const [merchant, red, blue, murderer] = state.players;
    const votes: Array<[string, string]> = [
      [merchant!.id, murderer!.id],
      [red!.id, murderer!.id],
      [blue!.id, red!.id],
      [murderer!.id, red!.id],
    ];
    for (const [voter, target] of votes) {
      const result = applyTableAction(state, voter, { type: 'cast_vote', targetPlayerId: target }, 600);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.resolution?.voteTotals[murderer!.id]).toBe(3);
    expect(state.resolution?.ballots.find((b) => b.voterId === merchant!.id)?.weight).toBe(2);
    expect(state.winner).toBe('guests');
  });

  it('gives the bomber a solo win and the murderer a win when a guest is locked', () => {
    let bomberState = forceRoles(start(4, {}, 1), ['bomber', 'murderer', 'guest_red', 'guest_blue']);
    for (const p of bomberState.players) {
      const result = applyTableAction(
        bomberState,
        p.id,
        { type: 'cast_vote', targetPlayerId: bomberState.players[0]!.id },
        400,
      );
      expect(result.ok).toBe(true);
      if (result.ok) bomberState = result.state;
    }
    expect(bomberState.winner).toBe('bomber');
    expect(bomberState.scores[bomberState.players[0]!.id]).toBe(5);
    expect(bomberState.scores[bomberState.players[1]!.id]).toBe(0);

    let escape = forceRoles(start(4, {}, 2), ['guest_red', 'murderer', 'accomplice', 'guest_blue']);
    for (const p of escape.players) {
      const result = applyTableAction(escape, p.id, { type: 'cast_vote', targetPlayerId: escape.players[0]!.id }, 500);
      if (result.ok) escape = result.state;
    }
    expect(escape.winner).toBe('murderers');
    expect(escape.scores[escape.players[1]!.id]).toBe(3);
    expect(escape.scores[escape.players[2]!.id]).toBe(3);
  });

  it('rejects a second vote and resolves when the clock expires', () => {
    let state = forceRoles(start(), ['murderer', 'guest_red', 'guest_blue', 'guest_yellow']);
    const first = applyTableAction(state, state.players[1]!.id, {
      type: 'cast_vote',
      targetPlayerId: state.players[0]!.id,
      nonce: 'vote-1',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const dupe = applyTableAction(first.state, state.players[1]!.id, {
      type: 'cast_vote',
      targetPlayerId: state.players[2]!.id,
    });
    expect(dupe.ok).toBe(false);
    const replay = applyTableAction(first.state, state.players[1]!.id, {
      type: 'cast_vote',
      targetPlayerId: state.players[2]!.id,
      nonce: 'vote-1',
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.state.players[1]!.voteTargetId).toBe(state.players[0]!.id);
    const timed = tickTable(first.state, first.state.phaseEndsAt! + 1);
    expect(timed.phase).toBe('result');
    expect(timed.winner).toBe('guests');
  });

  it('does not wait on a disconnected voter', () => {
    let state = forceRoles(start(), ['murderer', 'guest_red', 'guest_blue', 'guest_yellow']);
    state = setConnected(state, state.players[3]!.id, false);
    for (const p of state.players.slice(0, 3)) {
      const result = applyTableAction(state, p.id, { type: 'cast_vote', targetPlayerId: state.players[0]!.id }, 800);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.phase).toBe('result');
  });

  it('hides ballots when voting is anonymous and hides hands from other players', () => {
    const state = start(4, { anonymousVoting: true });
    const owner = state.players.find((p) => p.hand.length === 2)!;
    const other = state.players.find((p) => p.id !== owner.id)!;
    const outsider = getTableView(state, other.id);
    expect(outsider.private.hand).toHaveLength(0);
    expect(outsider.public.revealedRoles).toBeNull();
    expect(outsider.private.role).toBeNull();
    expect(owner.hand).toHaveLength(2);
    const finished = tickTable(
      forceRoles(start(4, { anonymousVoting: true }), ['murderer', 'guest_red', 'guest_blue', 'guest_yellow']),
      99_000,
    );
    const view = getTableView(finished, finished.players[1]!.id);
    expect(view.public.voteBreakdown).toBeNull();
    expect(view.public.voteTotals).toEqual({});
    expect(view.public.revealedRoles?.[finished.players[0]!.id]).toBe('murderer');
    expect(view.private.role).toBe('guest_red');
    expect(view.public.winner).toBe('murderers');
  });
});

describe('guards, integrity, and speed', () => {
  it('clamps settings and strips unsafe text', () => {
    const next = sanitizeSettings({
      maxPlayers: 99,
      descriptionSeconds: 1,
      discussionSeconds: 9999,
      votingSeconds: 0,
      rounds: 40,
      deckType: 'nope',
      passDirection: 'sideways',
      enabledSpecials: ['bomber', 'bomber', 'spy'],
    });
    expect(next.maxPlayers).toBe(9);
    expect(next.minPlayers).toBe(4);
    expect(next.descriptionSeconds).toBe(10);
    expect(next.discussionSeconds).toBe(600);
    expect(next.votingSeconds).toBe(5);
    expect(next.rounds).toBe(5);
    expect(next.deckType).toBe('boiler');
    expect(next.passDirection).toBe('clockwise');
    expect(next.enabledSpecials).toEqual(['bomber']);
    expect(cleanText('  <script>alert(1)</script> \u0000hi ', 8)).toBe('scriptal');
  });

  it('detects tampering and survives a JSON round trip', () => {
    const state = passAll(start());
    const saved = JSON.parse(JSON.stringify(state)) as TableState;
    expect(checksumState(saved)).toBe(checksumState(state));
    saved.players[0]!.role = 'murderer';
    expect(checksumState(saved)).not.toBe(checksumState(state));
    const restored = tickTable(saved, saved.phaseEndsAt! - 1);
    expect(restored.phase).toBe('description');
  });

  it('plays nine seats of chat and votes quickly', () => {
    const began = performance.now();
    let state = describeAll(passAll(start(9, { descriptionSeconds: 30 }, 21)));
    const now = 30_000;
    for (let n = 0; n < 40; n++) {
      const speaker = state.players[n % state.players.length]!;
      const sent = applyTableAction(state, speaker.id, { type: 'chat', text: `wave ${n}` }, now + n * 20);
      if (sent.ok) state = sent.state;
    }
    state = tickTable(state, state.phaseEndsAt! + 1);
    for (const p of state.players) {
      if (!p.connected || !p.canVote || p.hasVoted) continue;
      const voted = applyTableAction(state, p.id, { type: 'cast_vote', targetPlayerId: state.players[0]!.id }, 90_000);
      if (voted.ok) state = voted.state;
    }
    expect(state.phase === 'result' || state.phase === 'voting').toBe(true);
    expect(performance.now() - began).toBeLessThan(500);
    void nudgeTable;
  });
});
