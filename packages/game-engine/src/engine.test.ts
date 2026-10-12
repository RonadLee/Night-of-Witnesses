import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction';
import { runBots } from './bots';
import { createMatch } from './createMatch';
import { getView } from './getView';
import { buildDeck } from './roles';
import { createRng } from './rng';
import { tick } from './tick';
import { defaultVariant, type MatchState } from './state';

function seats(n: number, humanId = 'human') {
  return Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? humanId : `bot-${i}`,
    name: i === 0 ? 'You' : `Bot ${i}`,
    isBot: i !== 0,
    seatIndex: i,
  }));
}

function forceRoles(state: MatchState, roles: MatchState['players'][number]['role'][]): MatchState {
  const next = structuredClone(state);
  roles.forEach((role, i) => {
    next.players[i]!.role = role;
    next.players[i]!.hand = [];
    next.players[i]!.passedCard = role === 'doctor' ? 'spy' : 'doctor';
  });
  next.guestRoomCard = 'priest';
  next.deck = [];
  next.phase = 'information';
  next.currentSeat = 0;
  return next;
}

describe('buildDeck', () => {
  it('builds playerCount+1 cards for 4 and 9', () => {
    const v = defaultVariant();
    expect(buildDeck(4, v, createRng(1))).toHaveLength(5);
    expect(buildDeck(9, v, createRng(2))).toHaveLength(10);
  });

  it('includes accomplice at 6+ in standard mode', () => {
    const deck6 = buildDeck(6, defaultVariant(), createRng(3));
    expect(deck6.filter((r) => r === 'accomplice')).toHaveLength(1);
    const deck4 = buildDeck(4, defaultVariant(), createRng(4));
    expect(deck4.filter((r) => r === 'accomplice')).toHaveLength(0);
  });

  it('rejects invalid counts', () => {
    expect(() => buildDeck(3, defaultVariant(), createRng(1))).toThrow();
    expect(() => buildDeck(10, defaultVariant(), createRng(1))).toThrow();
  });
});

describe('createMatch + phase 1', () => {
  it('starts role assignment with two cards for seat 0', () => {
    const state = createMatch({ players: seats(4), seed: 42 });
    expect(state.phase).toBe('role_assignment');
    expect(state.players[0]!.hand).toHaveLength(2);
    const view = getView(state, 'human');
    expect(view.private.hand).toHaveLength(2);
    expect(view.private.legalActions).toContain('keep_card');
  });

  it('completes pass chain into Guest Room', () => {
    let state = createMatch({ players: seats(4), seed: 99 });
    for (let i = 0; i < 4; i++) {
      const actor = state.players[state.currentSeat]!;
      const result = applyAction(state, actor.id, { type: 'keep_card', keepIndex: 0 });
      expect(result.ok).toBe(true);
      state = result.state;
    }
    expect(state.phase).toBe('information');
    expect(state.guestRoomCard).toBeTruthy();
    expect(state.players.every((p) => p.role)).toBe(true);
  });

  it('rejects keep on wrong turn', () => {
    const state = createMatch({ players: seats(4), seed: 1 });
    const result = applyAction(state, 'bot-1', { type: 'keep_card', keepIndex: 0 });
    expect(result.ok).toBe(false);
  });
});

describe('privacy getView', () => {
  it('does not leak other roles or guest room', () => {
    let state = createMatch({ players: seats(4), seed: 7 });
    state = runBots(state);
    // finish remaining human keeps if any
    while (state.phase === 'role_assignment') {
      const cur = state.players[state.currentSeat]!;
      if (cur.isBot) {
        state = runBots(state);
        continue;
      }
      const r = applyAction(state, cur.id, { type: 'keep_card', keepIndex: 0 });
      state = r.state;
      state = runBots(state);
    }
    const humanView = getView(state, 'human');
    const otherRoles = state.players.filter((p) => p.id !== 'human').map((p) => p.role);
    expect(humanView.private.role).toBe(state.players[0]!.role);
    expect(humanView.private.guestRoomCard).toBeNull();
    // public players must not include kept-role fields or hands
    for (const p of humanView.public.players) {
      expect(p).not.toHaveProperty('role');
      expect(p).not.toHaveProperty('hand');
    }
    expect(otherRoles.every(Boolean)).toBe(true);
    // Kept identities stay private until result (pass feed may show passed card types)
    expect(humanView.public.revealedRoles).toBeNull();
    expect(humanView.private.guestRoomCard).toBeNull();
  });
});

describe('phase 2 abilities', () => {
  it('doctor confirms murderer status privately', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 1 }), [
      'doctor',
      'murderer',
      'spy',
      'priest',
    ]);
    state = applyAction(state, 'human', {
      type: 'announce_sighting',
      claimedRole: 'spy',
      claimedThroughPlayerId: 'bot-1',
    }).state;
    state = applyAction(state, 'human', {
      type: 'use_doctor',
      targetPlayerId: 'bot-1',
    }).state;
    const view = getView(state, 'human');
    expect(view.private.doctorResult).toEqual({
      targetPlayerId: 'bot-1',
      isMurderer: true,
    });
  });

  it('detective fails closed without passed card', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 1 }), [
      'detective',
      'murderer',
      'spy',
      'priest',
    ]);
    state.players[1]!.passedCard = null;
    state = applyAction(state, 'human', {
      type: 'announce_sighting',
      claimedRole: 'murderer',
      claimedThroughPlayerId: 'bot-2',
    }).state;
    const result = applyAction(state, 'human', {
      type: 'use_detective',
      targetPlayerId: 'bot-1',
    });
    expect(result.ok).toBe(false);
  });

  it('spy peeks guest room privately', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 1 }), [
      'spy',
      'murderer',
      'doctor',
      'priest',
    ]);
    state.guestRoomCard = 'accomplice';
    state = applyAction(state, 'human', {
      type: 'announce_sighting',
      claimedRole: 'doctor',
      claimedThroughPlayerId: 'bot-2',
    }).state;
    state = applyAction(state, 'human', { type: 'use_spy' }).state;
    expect(getView(state, 'human').private.guestRoomCard).toBe('accomplice');
    expect(getView(state, 'bot-1').private.guestRoomCard).toBeNull();
  });
});

describe('voting', () => {
  it('witnesses win when murderer is locked', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 2 }), [
      'doctor',
      'murderer',
      'spy',
      'priest',
    ]);
    state.phase = 'voting';
    state.currentSeat = -1;
    for (const p of state.players) {
      state = applyAction(state, p.id, { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
    }
    expect(state.phase).toBe('result');
    expect(state.winnerSide).toBe('witnesses');
    expect(state.lockedPlayerId).toBe('bot-1');
  });

  it('murderers win when innocent is locked', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 2 }), [
      'doctor',
      'murderer',
      'spy',
      'priest',
    ]);
    state.phase = 'voting';
    for (const p of state.players) {
      state = applyAction(state, p.id, { type: 'cast_vote', targetPlayerId: 'human' }).state;
    }
    expect(state.winnerSide).toBe('murderers');
  });

  it('rejects vote before voting phase', () => {
    const state = createMatch({ players: seats(4), seed: 1 });
    const result = applyAction(state, 'human', { type: 'cast_vote', targetPlayerId: 'bot-1' });
    expect(result.ok).toBe(false);
  });

  it('revotes once on tie then randomizes', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 5 }), [
      'doctor',
      'murderer',
      'spy',
      'priest',
    ]);
    state.phase = 'voting';
    state = applyAction(state, 'human', { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
    state = applyAction(state, 'bot-1', { type: 'cast_vote', targetPlayerId: 'human' }).state;
    state = applyAction(state, 'bot-2', { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
    state = applyAction(state, 'bot-3', { type: 'cast_vote', targetPlayerId: 'human' }).state;
    expect(state.phase).toBe('voting');
    expect(state.revoteCount).toBe(1);
    // second round still tied 2-2
    state = applyAction(state, 'human', { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
    state = applyAction(state, 'bot-1', { type: 'cast_vote', targetPlayerId: 'human' }).state;
    state = applyAction(state, 'bot-2', { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
    state = applyAction(state, 'bot-3', { type: 'cast_vote', targetPlayerId: 'human' }).state;
    expect(state.phase).toBe('result');
    expect(['human', 'bot-1']).toContain(state.lockedPlayerId);
  });
});

describe('discussion timer', () => {
  it('tick ends discussion when timer expires', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 1 }), [
      'doctor',
      'murderer',
      'spy',
      'priest',
    ]);
    state.phase = 'discussion';
    state.phaseEndsAt = 1000;
    state = tick(state, 1000);
    expect(state.phase).toBe('voting');
  });
});

describe('solo bots full round', () => {
  it('can finish a round with one human and bots', () => {
    let state = createMatch({ players: seats(5), seed: 12345 });
    let guard = 0;
    while (state.phase !== 'result' && guard++ < 500) {
      state = runBots(state, 1_000_000 + guard);
      if (state.phase === 'discussion') {
        state = applyAction(state, 'human', { type: 'end_discussion' }).state;
        continue;
      }
      const view = getView(state, 'human');
      const actionType = view.private.legalActions.find(
        (a) => a !== 'chat' && a !== 'gesture' && a !== 'end_discussion',
      );
      if (!actionType) {
        state = runBots(state, 1_000_000 + guard);
        continue;
      }
      if (actionType === 'keep_card') {
        state = applyAction(state, 'human', { type: 'keep_card', keepIndex: 0 }).state;
      } else if (actionType === 'announce_sighting') {
        state = applyAction(state, 'human', {
          type: 'announce_sighting',
          claimedRole: 'doctor',
          claimedThroughPlayerId: 'bot-1',
        }).state;
      } else if (actionType === 'skip_ability') {
        state = applyAction(state, 'human', { type: 'skip_ability' }).state;
      } else if (actionType === 'cast_vote') {
        state = applyAction(state, 'human', { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
      } else if (actionType.startsWith('use_')) {
        state = applyAction(state, 'human', { type: 'skip_ability' }).state;
      }
    }
    expect(state.phase).toBe('result');
    expect(state.winnerSide).toMatch(/witnesses|murderers/);
  });
});
