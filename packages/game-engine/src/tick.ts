import { applyAction } from './applyAction';
import type { MatchState } from './state';

/** Advance timers. Returns a new state if discussion expired. */
export function tick(state: MatchState, now: number): MatchState {
  if (state.phase === 'discussion' && state.phaseEndsAt !== null && now >= state.phaseEndsAt) {
    const host = state.players[0];
    if (!host) return state;
    const result = applyAction(state, host.id, { type: 'end_discussion' }, now);
    return result.state;
  }
  return state;
}
