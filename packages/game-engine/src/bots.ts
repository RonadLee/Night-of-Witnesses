import { chooseAiAction } from './ai/decide';
import { applyAction } from './applyAction';
import { getView } from './getView';
import type { MatchState } from './state';
import { tick } from './tick';

/** @deprecated Prefer chooseAiAction — kept for compatibility. */
export function chooseBotAction(state: MatchState, playerId: string, now = Date.now()) {
  return chooseAiAction(state, playerId, now);
}

/**
 * Fast-forward bots until a human must act (or discussion/result).
 * Used by tests and optional instant-sim; Solo UI prefers `tick` pacing.
 */
export function runBots(state: MatchState, now = Date.now(), maxSteps = 200): MatchState {
  let current = state;
  for (let i = 0; i < maxSteps; i++) {
    current = { ...current, nextBotActAt: now + i };
    current = tick(current, now + i + 1);
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
      (p) => p.isBot && chooseAiAction(current, p.id, now + i),
    );
    if (!anyBotLegal && current.phase !== 'voting') break;

    // Voting: keep stepping until all bots voted or phase changes
    if (current.phase === 'voting') {
      const pendingBot = current.players.some((p) => p.isBot && !p.hasVoted);
      if (!pendingBot) break;
      for (const p of current.players) {
        if (!p.isBot || p.hasVoted) continue;
        const action = chooseAiAction(current, p.id, now + i);
        if (action) {
          const r = applyAction(current, p.id, action, now + i);
          if (r.ok) current = r.state;
        }
      }
    }
  }
  return current;
}
