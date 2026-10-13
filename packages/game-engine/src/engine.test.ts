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
    next.players[i]!.passedCard = role === 'murderer' ? 'guest_yellow' : 'guest_blue';
    next.players[i]!.tickets = role === 'merchant' ? 2 : 1;
    next.players[i]!.abilityUsed = false;
    next.players[i]!.hasAnnounced = false;
  });
  next.guestRoomCard = 'guest_red';
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

  it('includes bomber when specialCards and 5+', () => {
    const deck5 = buildDeck(5, defaultVariant({ specialCards: true }), createRng(8));
    expect(deck5).toContain('bomber');
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

  it('stores claimed vs actual pass and hides actual from outsiders', () => {
    let state = createMatch({ players: seats(4), seed: 42 });
    const actor = state.players[state.currentSeat]!;
    const actualPass = actor.hand[1]!;
    state = applyAction(state, actor.id, {
      type: 'keep_card',
      keepIndex: 0,
      claimedRole: 'murderer',
    }).state;
    const entry = state.passHistory[0]!;
    expect(entry.actualRole).toBe(actualPass);
    expect(entry.claimedRole).toBe('murderer');
    expect(state.lastPassAnimation?.claimedRole).toBe('murderer');

    const outsider = getView(state, 'bot-2');
    expect(outsider.public.passHistory[0]?.claimedRole).toBe('murderer');
    expect(outsider.public.passHistory[0]?.actualRole).toBeNull();

    const passer = getView(state, actor.id);
    expect(passer.public.passHistory[0]?.actualRole).toBe(actualPass);
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
    for (const p of humanView.public.players) {
      expect(p).not.toHaveProperty('role');
      expect(p).not.toHaveProperty('hand');
    }
    expect(otherRoles.every(Boolean)).toBe(true);
    expect(humanView.public.revealedRoles).toBeNull();
  });
});

describe('phase 2 abilities', () => {
  it('butler secretly peeks two guests without notifying them', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 1 }), [
      'butler',
      'guest_yellow',
      'guest_blue',
      'murderer',
    ]);
    state = applyAction(state, 'human', {
      type: 'announce_sighting',
      claimedRole: 'guest_yellow',
      claimedThroughPlayerId: 'bot-1',
    }).state;
    state = applyAction(state, 'human', {
      type: 'use_butler',
      targetA: 'bot-1',
      targetB: 'bot-2',
    }).state;
    const butlerView = getView(state, 'human');
    expect(butlerView.private.butlerPeek).toEqual([
      { playerId: 'bot-1', role: 'guest_yellow' },
      { playerId: 'bot-2', role: 'guest_blue' },
    ]);
    expect(getView(state, 'bot-1').private.butlerPeek).toBeNull();
    expect(state.butlerWhitenedPlayerIds).toEqual(expect.arrayContaining(['bot-1', 'bot-2']));
  });

  it('detective sends target to Private Room and ends round', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 1 }), [
      'detective',
      'murderer',
      'guest_yellow',
      'merchant',
    ]);
    state = applyAction(state, 'human', {
      type: 'announce_sighting',
      claimedRole: 'murderer',
      claimedThroughPlayerId: 'bot-1',
    }).state;
    state = applyAction(state, 'human', {
      type: 'use_detective',
      targetPlayerId: 'bot-1',
    }).state;
    expect(state.phase).toBe('result');
    expect(state.privateRoomPlayerId).toBe('bot-1');
    expect(state.winnerSide).toBe('guest_side');
  });

  it('lawyer marks ticket target privately', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 1 }), [
      'lawyer',
      'murderer',
      'guest_yellow',
      'merchant',
    ]);
    state = applyAction(state, 'human', {
      type: 'announce_sighting',
      claimedRole: 'merchant',
      claimedThroughPlayerId: 'bot-3',
    }).state;
    state = applyAction(state, 'human', {
      type: 'use_lawyer',
      targetPlayerId: 'bot-3',
    }).state;
    expect(state.lawyerTargetId).toBe('bot-3');
    expect(getView(state, 'bot-3').public.abilityReveals.every((r) => r.kind !== 'lawyer')).toBe(
      true,
    );
  });
});

describe('voting / Private Room', () => {
  it('guest side wins when murderer enters Private Room', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 2 }), [
      'guest_yellow',
      'murderer',
      'guest_blue',
      'merchant',
    ]);
    state.phase = 'voting';
    state.currentSeat = -1;
    for (const p of state.players) {
      state = applyAction(state, p.id, { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
    }
    expect(state.phase).toBe('result');
    expect(state.winnerSide).toBe('guest_side');
    expect(state.privateRoomPlayerId).toBe('bot-1');
  });

  it('murderer side wins when innocent enters Private Room', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 2 }), [
      'guest_yellow',
      'murderer',
      'guest_blue',
      'merchant',
    ]);
    state.phase = 'voting';
    for (const p of state.players) {
      state = applyAction(state, p.id, { type: 'cast_vote', targetPlayerId: 'human' }).state;
    }
    expect(state.winnerSide).toBe('murderer_side');
  });

  it('bomber solo wins when bomber enters Private Room', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 2 }), [
      'guest_yellow',
      'murderer',
      'bomber',
      'merchant',
    ]);
    state.phase = 'voting';
    for (const p of state.players) {
      state = applyAction(state, p.id, { type: 'cast_vote', targetPlayerId: 'bot-2' }).state;
    }
    expect(state.winnerSide).toBe('bomber');
    expect(state.winningRoleIds).toContain('bomber');
  });

  it('merchant gains bonus tickets when murderer enters', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 2 }), [
      'merchant',
      'murderer',
      'guest_yellow',
      'lawyer',
    ]);
    state.lawyerTargetId = 'human';
    state.phase = 'voting';
    for (const p of state.players) {
      state = applyAction(state, p.id, { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
    }
    const row = state.ticketBreakdown?.find((t) => t.playerId === 'human');
    expect(row?.merchantBonus).toBe(2);
    expect(row?.lawyerPenalty).toBe(1);
    expect(row?.finalTickets).toBe(3); // 2 base + 2 bonus - 1 lawyer
  });

  it('rejects vote before voting phase', () => {
    const state = createMatch({ players: seats(4), seed: 1 });
    const result = applyAction(state, 'human', { type: 'cast_vote', targetPlayerId: 'bot-1' });
    expect(result.ok).toBe(false);
  });

  it('revotes once on tie then randomizes', () => {
    // All 1-ticket roles so a 2–2 split is a true weight tie
    let state = forceRoles(createMatch({ players: seats(4), seed: 5 }), [
      'guest_yellow',
      'murderer',
      'guest_blue',
      'guest_red',
    ]);
    state.phase = 'voting';
    state = applyAction(state, 'human', { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
    state = applyAction(state, 'bot-1', { type: 'cast_vote', targetPlayerId: 'human' }).state;
    state = applyAction(state, 'bot-2', { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
    state = applyAction(state, 'bot-3', { type: 'cast_vote', targetPlayerId: 'human' }).state;
    expect(state.phase).toBe('voting');
    expect(state.revoteCount).toBe(1);
    state = applyAction(state, 'human', { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
    state = applyAction(state, 'bot-1', { type: 'cast_vote', targetPlayerId: 'human' }).state;
    state = applyAction(state, 'bot-2', { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
    state = applyAction(state, 'bot-3', { type: 'cast_vote', targetPlayerId: 'human' }).state;
    expect(state.phase).toBe('result');
    expect(['human', 'bot-1']).toContain(state.privateRoomPlayerId);
  });
});

describe('discussion timer', () => {
  it('tick ends discussion when timer expires', () => {
    let state = forceRoles(createMatch({ players: seats(4), seed: 1 }), [
      'guest_yellow',
      'murderer',
      'guest_blue',
      'merchant',
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
          claimedRole: 'guest_yellow',
          claimedThroughPlayerId: 'bot-1',
        }).state;
      } else if (actionType === 'skip_ability') {
        state = applyAction(state, 'human', { type: 'skip_ability' }).state;
      } else if (actionType === 'cast_vote') {
        state = applyAction(state, 'human', { type: 'cast_vote', targetPlayerId: 'bot-1' }).state;
      } else if (actionType === 'use_detective') {
        // Avoid ending early mid-loop inconsistently — skip via skip when possible
        if (view.private.legalActions.includes('skip_ability')) {
          state = applyAction(state, 'human', { type: 'skip_ability' }).state;
        } else {
          state = applyAction(state, 'human', {
            type: 'use_detective',
            targetPlayerId: 'bot-1',
          }).state;
        }
      } else if (actionType.startsWith('use_')) {
        if (view.private.legalActions.includes('skip_ability')) {
          state = applyAction(state, 'human', { type: 'skip_ability' }).state;
        }
      }
    }
    expect(state.phase).toBe('result');
    expect(state.winnerSide).toMatch(/guest_side|murderer_side|bomber|none/);
  });
});
