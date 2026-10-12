import { describe, expect, it } from 'vitest';
import { applyAction } from '../applyAction';
import { createMatch } from '../createMatch';
import { getView } from '../getView';
import { runBots } from '../bots';
import { buildAiRoster } from './roster';
import { chooseAiAction } from './decide';

describe('AI roster + decisions', () => {
  it('builds distinct personalities for AI count', () => {
    const roster = buildAiRoster(5, 'hard', 42);
    expect(roster).toHaveLength(5);
    expect(new Set(roster.map((r) => r.name)).size).toBe(5);
    expect(roster.every((r) => r.difficulty === 'hard')).toBe(true);
  });

  it('expert AI prefers non-random keep when murderer in hand', () => {
    const roster = buildAiRoster(3, 'expert', 7);
    const players = [
      { id: 'human', name: 'You', isBot: false, seatIndex: 0 },
      ...roster.map((a, i) => ({
        id: a.id,
        name: a.name,
        isBot: true,
        seatIndex: i + 1,
        personality: a.personality,
        difficulty: a.difficulty,
        avatarId: a.avatarId,
      })),
    ];
    let state = createMatch({ players, seed: 99 });
    // Force current bot hand
    const bot = state.players[state.currentSeat]!;
    if (!bot.isBot) {
      const r = applyAction(state, 'human', { type: 'keep_card', keepIndex: 0 });
      state = r.state;
    }
    const actor = state.players[state.currentSeat]!;
    actor.hand = ['murderer', 'guest_yellow'];
    const action = chooseAiAction(state, actor.id, 1_000);
    expect(action?.type).toBe('keep_card');
    if (action?.type === 'keep_card') {
      expect(action.claimedRole).toBeTruthy();
    }
  });

  it('runBots completes a solo-style match with AI minds', () => {
    const roster = buildAiRoster(4, 'normal', 123);
    const players = [
      {
        id: 'human',
        name: 'You',
        isBot: false,
        seatIndex: 0,
        avatarId: 'avatar-you',
      },
      ...roster.map((a, i) => ({
        id: a.id,
        name: a.name,
        isBot: true,
        seatIndex: i + 1,
        personality: a.personality,
        difficulty: a.difficulty,
        avatarId: a.avatarId,
      })),
    ];
    let state = createMatch({
      players,
      seed: 55,
      variant: {
        discussionSeconds: 5,
        descriptionSeconds: 5,
        votingSeconds: 5,
      },
    });
    let guard = 0;
    while (state.phase !== 'result' && guard++ < 600) {
      state = runBots(state, 2_000_000 + guard);
      if (state.phase === 'discussion') {
        state = applyAction(state, 'human', { type: 'end_discussion' }, 2_000_000 + guard).state;
        continue;
      }
      const view = getView(state, 'human');
      const actionType = view.private.legalActions.find(
        (a) => a !== 'chat' && a !== 'gesture' && a !== 'end_discussion',
      );
      if (!actionType) continue;
      if (actionType === 'keep_card') {
        state = applyAction(state, 'human', { type: 'keep_card', keepIndex: 0 }).state;
      } else if (actionType === 'announce_sighting') {
        state = applyAction(state, 'human', {
          type: 'announce_sighting',
          claimedRole: 'guest_yellow',
          claimedThroughPlayerId: players[1]!.id,
          text: 'I saw a yellow guest near seat 2',
        }).state;
      } else if (actionType === 'use_detective') {
        state = applyAction(state, 'human', {
          type: 'use_detective',
          targetPlayerId: players[1]!.id,
        }).state;
      } else if (actionType === 'skip_ability' || actionType.startsWith('use_')) {
        if (view.private.legalActions.includes('skip_ability')) {
          state = applyAction(state, 'human', { type: 'skip_ability' }).state;
        }
      } else if (actionType === 'cast_vote') {
        state = applyAction(state, 'human', {
          type: 'cast_vote',
          targetPlayerId: players[1]!.id,
        }).state;
      }
    }
    expect(state.phase).toBe('result');
    expect(state.activity.length).toBeGreaterThan(3);
    expect(state.aiReasoning.length).toBeGreaterThan(0);
  });
});
