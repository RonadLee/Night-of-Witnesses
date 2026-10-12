'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  applyAction,
  buildAiRoster,
  createMatch,
  getView,
  tick,
  type MatchState,
} from '@now/game-engine';
import type { Action, PlayerMatchView, SoloLobbyConfig } from '@now/game-types';
import { GameTable } from '@/components/GameTable';
import { SoloLobby } from '@/components/game/SoloLobby';
import {
  autosave,
  clearSave,
  DEFAULT_SOLO_CONFIG,
  loadHistory,
  loadSave,
  loadStats,
  pushHistory,
  recordMatchResult,
  type SoloSaveBlob,
} from '@/lib/solo/storage';

const HUMAN_ID = 'human';

function leagueDifficulty(league: SoloLobbyConfig['campaignLeague']): SoloLobbyConfig['difficulty'] {
  switch (league) {
    case 'beginner':
      return 'easy';
    case 'intermediate':
      return 'normal';
    case 'advanced':
      return 'hard';
    case 'expert':
      return 'expert';
    default:
      return 'normal';
  }
}

export function SoloClient() {
  const searchParams = useSearchParams();
  const fastMode = searchParams.get('fast') === '1';
  const [screen, setScreen] = useState<'lobby' | 'table'>('lobby');
  const [config, setConfig] = useState<SoloLobbyConfig>(() =>
    fastMode
      ? {
          ...DEFAULT_SOLO_CONFIG,
          aiCount: 3,
          descriptionSeconds: 8,
          discussionSeconds: 8,
          votingSeconds: 5,
        }
      : DEFAULT_SOLO_CONFIG,
  );
  const [seed, setSeed] = useState(1);
  const [state, setState] = useState<MatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState(loadStats);
  const [hasSave, setHasSave] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [now, setNow] = useState(0);
  const [recordedResult, setRecordedResult] = useState(false);

  const effectiveDifficulty = config.campaignLeague
    ? leagueDifficulty(config.campaignLeague)
    : config.difficulty;

  // Stable seed on client only — avoids SSR/client roster name mismatches
  const roster = useMemo(
    () => buildAiRoster(config.aiCount, effectiveDifficulty, seed),
    [config.aiCount, effectiveDifficulty, seed],
  );

  const view: PlayerMatchView | null = useMemo(
    () => (state ? getView(state, HUMAN_ID) : null),
    [state],
  );

  useEffect(() => {
    setSeed(42);
    setHasSave(Boolean(loadSave()));
    setHistoryCount(loadHistory().length);
    setStats(loadStats());
  }, []);

  // Live clock + AI pacing (faster interval in e2e/fast mode)
  useEffect(() => {
    if (screen !== 'table' || !state || state.phase === 'result') return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setState((prev) => {
        if (!prev) return prev;
        let next = tick(prev, t);
        // In fast mode, step bots more aggressively so e2e can finish
        if (fastMode) {
          for (let i = 0; i < 6; i++) {
            next = tick(next, t + i + 1);
            if (next.phase === 'result') break;
            const humanLegal = getView(next, HUMAN_ID).private.legalActions.some(
              (a) => a !== 'chat' && a !== 'gesture' && a !== 'end_discussion',
            );
            if (humanLegal) break;
          }
        }
        return next;
      });
    }, fastMode ? 120 : 400);
    return () => window.clearInterval(id);
  }, [screen, state?.phase, fastMode]);

  // Autosave
  useEffect(() => {
    if (!state || screen !== 'table') return;
    const blob: SoloSaveBlob = {
      savedAt: Date.now(),
      config,
      humanId: HUMAN_ID,
      state,
    };
    autosave(blob);
    setHasSave(true);
  }, [state, screen, config]);

  // Record stats on result once
  useEffect(() => {
    if (!state || state.phase !== 'result' || recordedResult) return;
    const won =
      (state.winnerSide === 'witnesses' &&
        state.players.find((p) => p.id === HUMAN_ID)?.role !== 'murderer' &&
        state.players.find((p) => p.id === HUMAN_ID)?.role !== 'accomplice') ||
      (state.winnerSide === 'murderers' &&
        (state.players.find((p) => p.id === HUMAN_ID)?.role === 'murderer' ||
          state.players.find((p) => p.id === HUMAN_ID)?.role === 'accomplice'));
    const human = state.players.find((p) => p.id === HUMAN_ID);
    const murderer = state.players.find((p) => p.role === 'murderer');
    const votedCorrectly = Boolean(
      human?.voteTargetId && murderer && human.voteTargetId === murderer.id,
    );
    const nextStats = recordMatchResult({
      difficulty: effectiveDifficulty,
      won: Boolean(won),
      score: state.scores[HUMAN_ID] ?? 0,
      votedCorrectly,
    });
    pushHistory({
      at: Date.now(),
      winnerSide: state.winnerSide ?? 'unknown',
      difficulty: effectiveDifficulty,
      league: config.campaignLeague,
      playerCount: state.players.length,
    });
    setStats(nextStats);
    setHistoryCount(loadHistory().length);
    setRecordedResult(true);
    clearSave();
    setHasSave(false);
  }, [state, recordedResult, effectiveDifficulty, config.campaignLeague]);

  function start() {
    const nextSeed = Date.now();
    setSeed(nextSeed);
    const ai = buildAiRoster(config.aiCount, effectiveDifficulty, nextSeed);
    const players = [
      {
        id: HUMAN_ID,
        name: 'You',
        isBot: false,
        seatIndex: 0,
        avatarId: 'avatar-you',
      },
      ...ai.map((a, i) => ({
        id: a.id,
        name: a.name,
        isBot: true,
        seatIndex: i + 1,
        avatarId: a.avatarId,
        personality: a.personality,
        difficulty: a.difficulty,
      })),
    ];
    const match = createMatch({
      players,
      seed: nextSeed,
      variant: {
        discussionSeconds: config.discussionSeconds,
        descriptionSeconds: config.descriptionSeconds,
        votingSeconds: config.votingSeconds,
        rounds: config.rounds,
        passDirection: config.passDirection,
        deckType: config.deckType,
        specialCards: config.specialCards,
        murdererCount: config.deckType === 'double_murderer' ? 2 : 1,
      },
    });
    setState(match);
    setScreen('table');
    setError(null);
    setRecordedResult(false);
  }

  function resume() {
    const save = loadSave();
    if (!save) return;
    setConfig(save.config);
    setState(save.state);
    setScreen('table');
    setError(null);
    setRecordedResult(save.state.phase === 'result');
  }

  function onAction(action: Action) {
    if (!state) return;
    const result = applyAction(state, HUMAN_ID, action, Date.now());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setState(tick(result.state, Date.now()));
  }

  function manualSave() {
    if (!state) return;
    autosave({ savedAt: Date.now(), config, humanId: HUMAN_ID, state });
    setHasSave(true);
    setError('Game saved.');
  }

  if (screen === 'lobby' || !state || !view) {
    return (
      <SoloLobby
        config={config}
        onChange={setConfig}
        roster={roster}
        stats={stats}
        hasSave={hasSave}
        onStart={start}
        onResume={resume}
        historyCount={historyCount}
      />
    );
  }

  return (
    <>
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 pt-4">
        <button
          type="button"
          className="text-sm text-[var(--fog)] hover:text-[var(--ember-hot)]"
          onClick={() => {
            manualSave();
            setScreen('lobby');
            setState(null);
          }}
        >
          ← Lobby
        </button>
        <button
          type="button"
          className="border border-[var(--line)] px-3 py-1.5 text-xs uppercase tracking-wide"
          onClick={manualSave}
        >
          Save
        </button>
      </div>
      <GameTable
        view={view}
        selfId={HUMAN_ID}
        onAction={onAction}
        statusMessage={error}
        now={now}
        onPlayAgain={start}
        onBackLobby={() => {
          setScreen('lobby');
          setState(null);
        }}
      />
    </>
  );
}
