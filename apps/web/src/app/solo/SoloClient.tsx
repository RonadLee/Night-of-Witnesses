'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  applyAction,
  createMatch,
  getView,
  runBots,
  tick,
  type MatchState,
} from '@now/game-engine';
import type { Action, PlayerMatchView } from '@now/game-types';
import { GameTable } from '@/components/GameTable';

const HUMAN_ID = 'human';

function makeSeats(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i === 0 ? HUMAN_ID : `bot-${i}`,
    name: i === 0 ? 'You' : `Witness ${i}`,
    isBot: i !== 0,
    seatIndex: i,
  }));
}

export function SoloClient() {
  const [playerCount, setPlayerCount] = useState(5);
  const [state, setState] = useState<MatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const view: PlayerMatchView | null = useMemo(
    () => (state ? getView(state, HUMAN_ID) : null),
    [state],
  );

  const phase = state?.phase;
  const phaseEndsAt = state?.phaseEndsAt;
  useEffect(() => {
    if (phase !== 'discussion' || !phaseEndsAt) return;
    const id = window.setInterval(() => {
      setState((prev) => (prev ? tick(prev, Date.now()) : prev));
      setTick((t) => t + 1);
    }, 500);
    return () => window.clearInterval(id);
  }, [phase, phaseEndsAt]);

  function start() {
    let next = createMatch({ players: makeSeats(playerCount), seed: Date.now() });
    next = runBots(next);
    setState(next);
    setError(null);
  }

  function onAction(action: Action) {
    if (!state) return;
    const result = applyAction(state, HUMAN_ID, action);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setState(runBots(result.state));
  }

  if (!state || !view) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16">
        <h1
          className="text-4xl font-extrabold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Solo Mode
        </h1>
        <p className="text-[var(--fog)]">
          Play a full round against scripted witnesses. Same rules engine as multiplayer.
        </p>
        <label className="flex flex-col gap-2 text-sm">
          Table size
          <select
            className="bg-[var(--bg-mist)] px-3 py-3"
            value={playerCount}
            onChange={(e) => setPlayerCount(Number(e.target.value))}
          >
            {[4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                {n} players (you + {n - 1} bots)
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={start}
          className="bg-[var(--ember)] px-6 py-4 font-semibold text-[#1a0f0a]"
        >
          Start night
        </button>
      </div>
    );
  }

  return (
    <>
      <GameTable view={view} selfId={HUMAN_ID} onAction={onAction} statusMessage={error} />
      {view.public.phase === 'result' && (
        <div className="mx-auto max-w-3xl px-4 pb-12">
          <button
            type="button"
            className="border border-[var(--fog)] px-4 py-3"
            onClick={() => setState(null)}
          >
            Play again
          </button>
        </div>
      )}
    </>
  );
}
