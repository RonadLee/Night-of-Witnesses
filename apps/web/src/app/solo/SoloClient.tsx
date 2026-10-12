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
import type { Action, AiDifficulty, DeckType, PassDirection, PlayerMatchView, SoloLobbyConfig } from '@now/game-types';
import { MIN_PLAYERS, MAX_PLAYERS } from '@now/game-types';
import { GameTable } from '@/components/GameTable';
import { MatchLobby } from '@/components/match/MatchLobby';
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

function leagueDifficulty(league: SoloLobbyConfig['campaignLeague']): AiDifficulty {
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
  const [now, setNow] = useState(0);
  const [recordedResult, setRecordedResult] = useState(false);

  const effectiveDifficulty = config.campaignLeague
    ? leagueDifficulty(config.campaignLeague)
    : config.difficulty;

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
    setStats(loadStats());
  }, []);

  useEffect(() => {
    if (screen !== 'table' || !state || state.phase === 'result') return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setState((prev) => {
        if (!prev) return prev;
        let next = tick(prev, t);
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

  useEffect(() => {
    if (!state || screen !== 'table') return;
    const blob: SoloSaveBlob = { savedAt: Date.now(), config, humanId: HUMAN_ID, state };
    autosave(blob);
    setHasSave(true);
  }, [state, screen, config]);

  useEffect(() => {
    if (!state || state.phase !== 'result' || recordedResult) return;
    const role = state.players.find((p) => p.id === HUMAN_ID)?.role;
    const won =
      (state.winnerSide === 'guest_side' &&
        role !== 'murderer' &&
        role !== 'accomplice' &&
        role !== 'bomber') ||
      (state.winnerSide === 'murderer_side' &&
        (role === 'murderer' || role === 'accomplice')) ||
      (state.winnerSide === 'bomber' && role === 'bomber');
    const human = state.players.find((p) => p.id === HUMAN_ID);
    const murderer = state.players.find((p) => p.role === 'murderer');
    const votedCorrectly = Boolean(
      human?.voteTargetId && murderer && human.voteTargetId === murderer.id,
    );
    setStats(
      recordMatchResult({
        difficulty: effectiveDifficulty,
        won: Boolean(won),
        score: state.scores[HUMAN_ID] ?? 0,
        votedCorrectly,
      }),
    );
    pushHistory({
      at: Date.now(),
      winnerSide: state.winnerSide ?? 'unknown',
      difficulty: effectiveDifficulty,
      league: config.campaignLeague,
      playerCount: state.players.length,
    });
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

  const lobbySeats = [
    {
      id: HUMAN_ID,
      name: 'You',
      seatIndex: 0,
      avatarId: 'avatar-you',
      isSelf: true,
      isHost: true,
      subtitle: 'Human',
    },
    ...roster.map((a, i) => ({
      id: a.id,
      name: a.name,
      seatIndex: i + 1,
      avatarId: a.avatarId,
      subtitle: `${a.personality} · ${a.difficulty}`,
    })),
  ];

  if (screen === 'lobby' || !state || !view) {
    return (
      <MatchLobby
        modeLabel="Solo"
        seats={lobbySeats}
        minPlayers={MIN_PLAYERS}
        maxPlayers={MAX_PLAYERS}
        canStart
        startLabel="Start match"
        onStart={start}
        error={error}
        setupSlot={
          <SetupPanel
            config={config}
            onChange={setConfig}
            statsLine={`${stats.gamesPlayed} games · ${
              stats.gamesPlayed ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0
            }% win · ${loadHistory().length} history`}
          />
        }
        footerSlot={
          hasSave ? (
            <button
              type="button"
              className="border border-[var(--fog)] px-6 py-4 font-semibold"
              onClick={resume}
            >
              Resume last game
            </button>
          ) : null
        }
      />
    );
  }

  return (
    <>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 pt-4">
        <button
          type="button"
          className="text-sm text-[var(--fog)] hover:text-[var(--ember-hot)]"
          onClick={() => {
            autosave({ savedAt: Date.now(), config, humanId: HUMAN_ID, state });
            setScreen('lobby');
            setState(null);
          }}
        >
          ← Lobby
        </button>
        <button
          type="button"
          className="border border-[var(--line)] px-3 py-1.5 text-xs uppercase tracking-wide"
          onClick={() => {
            autosave({ savedAt: Date.now(), config, humanId: HUMAN_ID, state });
            setError('Game saved.');
          }}
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

function SetupPanel({
  config,
  onChange,
  statsLine,
}: {
  config: SoloLobbyConfig;
  onChange: (c: SoloLobbyConfig) => void;
  statsLine: string;
}) {
  function patch<K extends keyof SoloLobbyConfig>(key: K, value: SoloLobbyConfig[K]) {
    onChange({ ...config, [key]: value });
  }
  return (
    <div className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4 sm:grid-cols-2">
      <p className="sm:col-span-2 text-xs text-[var(--fog-dim)]">{statsLine}</p>
      <label className="flex flex-col gap-1 text-sm text-[var(--fog)]">
        AI players
        <select
          className="field"
          value={config.aiCount}
          onChange={(e) => patch('aiCount', Number(e.target.value))}
        >
          {[3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              {n} AI ({n + 1} at table)
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--fog)]">
        Difficulty
        <select
          className="field"
          value={config.difficulty}
          onChange={(e) => patch('difficulty', e.target.value as AiDifficulty)}
        >
          {(['easy', 'normal', 'hard', 'expert'] as AiDifficulty[]).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--fog)]">
        Deck
        <select
          className="field"
          value={config.deckType}
          onChange={(e) => patch('deckType', e.target.value as DeckType)}
        >
          <option value="standard">Standard</option>
          <option value="double_murderer">Double Murderer</option>
          <option value="witness_heavy">Witness Heavy</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--fog)]">
        Pass direction
        <select
          className="field"
          value={config.passDirection}
          onChange={(e) => patch('passDirection', e.target.value as PassDirection)}
        >
          <option value="clockwise">Clockwise</option>
          <option value="counterclockwise">Counterclockwise</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--fog)]">
        Description (sec)
        <input
          type="number"
          className="field"
          min={15}
          max={120}
          value={config.descriptionSeconds}
          onChange={(e) => patch('descriptionSeconds', Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--fog)]">
        Discussion (sec)
        <input
          type="number"
          className="field"
          min={30}
          max={600}
          value={config.discussionSeconds}
          onChange={(e) => patch('discussionSeconds', Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--fog)]">
        Voting (sec)
        <input
          type="number"
          className="field"
          min={5}
          max={60}
          value={config.votingSeconds}
          onChange={(e) => patch('votingSeconds', Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--fog)]">
        Rounds
        <select
          className="field"
          value={config.rounds}
          onChange={(e) => patch('rounds', Number(e.target.value))}
        >
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
