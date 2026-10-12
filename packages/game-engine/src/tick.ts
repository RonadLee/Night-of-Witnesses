import {
  applyAction,
  forceExpireInformation,
  forceExpireVoting,
} from './applyAction';
import { chooseAiAction } from './ai/decide';
import type { MatchState } from './state';

/** Advance timers and paced AI actions. */
export function tick(state: MatchState, now: number): MatchState {
  let current = state;

  if (current.phase === 'discussion' && current.phaseEndsAt !== null && now >= current.phaseEndsAt) {
    const host = current.players[0];
    if (host) {
      const result = applyAction(current, host.id, { type: 'end_discussion' }, now);
      current = result.state;
    }
  }

  if (
    current.phase === 'information' &&
    current.phaseEndsAt !== null &&
    now >= current.phaseEndsAt
  ) {
    current = forceExpireInformation(current, now);
  }

  if (current.phase === 'voting' && current.phaseEndsAt !== null && now >= current.phaseEndsAt) {
    current = forceExpireVoting(current, now);
  }

  // Paced bot actions (solo + any bot seats)
  if (
    current.nextBotActAt !== null &&
    now >= current.nextBotActAt &&
    current.phase !== 'result'
  ) {
    current = stepBots(current, now);
  }

  return current;
}

function stepBots(state: MatchState, now: number): MatchState {
  let current = state;
  const bots = current.players.filter((p) => p.isBot);
  const fast = current.variant.discussionSeconds <= 15 || current.variant.descriptionSeconds <= 10;
  const chatGap = fast ? 200 : 1800;
  const voteGap = fast ? 80 : 450;
  const turnGap = fast ? 80 : 650;

  if (current.phase === 'discussion') {
    for (const bot of bots) {
      const action = chooseAiAction(current, bot.id, now);
      if (action?.type === 'chat' || action?.type === 'gesture') {
        const result = applyAction(current, bot.id, action, now);
        if (result.ok) current = result.state;
        break;
      }
    }
    current = { ...current, nextBotActAt: now + chatGap };
    return current;
  }

  if (current.phase === 'voting') {
    for (const bot of bots) {
      if (bot.hasVoted) continue;
      const action = chooseAiAction(current, bot.id, now);
      if (action?.type === 'cast_vote') {
        const result = applyAction(current, bot.id, action, now);
        if (result.ok) {
          current = result.state;
          current = { ...current, nextBotActAt: now + voteGap };
          return current;
        }
      }
    }
    current = { ...current, nextBotActAt: now + (fast ? 120 : 800) };
    return current;
  }

  const cur = current.currentSeat >= 0 ? current.players[current.currentSeat] : null;
  if (cur?.isBot) {
    const action = chooseAiAction(current, cur.id, now);
    if (action) {
      const result = applyAction(current, cur.id, action, now);
      if (result.ok) current = result.state;
    }
  }
  const nextCur = current.currentSeat >= 0 ? current.players[current.currentSeat] : null;
  current = {
    ...current,
    nextBotActAt: nextCur?.isBot ? now + turnGap : now + (fast ? 120 : 1200),
  };
  return current;
}
