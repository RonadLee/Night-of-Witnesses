'use client';

import type { AiDifficulty, CampaignLeague, DeckType, PassDirection, SoloLobbyConfig, SoloStats } from '@now/game-types';
import type { AiProfile } from '@now/game-engine';
import { AVATAR_COLORS, avatarInitials } from '@/lib/solo/avatars';
import { DEFAULT_SOLO_CONFIG } from '@/lib/solo/storage';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Props {
  config: SoloLobbyConfig;
  onChange: (next: SoloLobbyConfig) => void;
  roster: AiProfile[];
  stats: SoloStats;
  hasSave: boolean;
  onStart: () => void;
  onResume: () => void;
  historyCount: number;
}

export function SoloLobby({
  config,
  onChange,
  roster,
  stats,
  hasSave,
  onStart,
  onResume,
  historyCount,
}: Props) {
  const totalPlayers = config.aiCount + 1;
  const winRate = stats.gamesPlayed
    ? Math.round((stats.wins / stats.gamesPlayed) * 100)
    : 0;

  function patch<K extends keyof SoloLobbyConfig>(key: K, value: SoloLobbyConfig[K]) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
            Solo Lobby
          </h1>
          <p className="mt-2 max-w-xl text-[var(--fog)]">
            Configure the table the same way as Multiplayer — AI opponents fill every other seat.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <section className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4 sm:grid-cols-3">
        <Stat label="Games" value={String(stats.gamesPlayed)} />
        <Stat label="Win rate" value={`${winRate}%`} />
        <Stat label="History" value={String(historyCount)} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="AI players">
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
        </Field>
        <Field label="AI difficulty">
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
        </Field>
        <Field label="Card deck">
          <select
            className="field"
            value={config.deckType}
            onChange={(e) => patch('deckType', e.target.value as DeckType)}
          >
            <option value="standard">Standard</option>
            <option value="double_murderer">Double Murderer</option>
            <option value="witness_heavy">Witness Heavy</option>
          </select>
        </Field>
        <Field label="Pass direction">
          <select
            className="field"
            value={config.passDirection}
            onChange={(e) => patch('passDirection', e.target.value as PassDirection)}
          >
            <option value="clockwise">Clockwise</option>
            <option value="counterclockwise">Counterclockwise</option>
          </select>
        </Field>
        <Field label="Rounds">
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
        </Field>
        <Field label="Description duration (sec)">
          <input
            type="number"
            min={15}
            max={120}
            className="field"
            value={config.descriptionSeconds}
            onChange={(e) => patch('descriptionSeconds', Number(e.target.value))}
          />
        </Field>
        <Field label="Discussion duration (sec)">
          <input
            type="number"
            min={30}
            max={600}
            className="field"
            value={config.discussionSeconds}
            onChange={(e) => patch('discussionSeconds', Number(e.target.value))}
          />
        </Field>
        <Field label="Voting duration (sec)">
          <input
            type="number"
            min={5}
            max={60}
            className="field"
            value={config.votingSeconds}
            onChange={(e) => patch('votingSeconds', Number(e.target.value))}
          />
        </Field>
        <Field label="Special cards">
          <select
            className="field"
            value={config.specialCards ? 'on' : 'off'}
            onChange={(e) => patch('specialCards', e.target.value === 'on')}
          >
            <option value="on">Enabled</option>
            <option value="off">Disabled</option>
          </select>
        </Field>
        <Field label="Campaign league">
          <select
            className="field"
            value={config.campaignLeague ?? ''}
            onChange={(e) =>
              patch(
                'campaignLeague',
                (e.target.value || null) as CampaignLeague | null,
              )
            }
          >
            <option value="">Free play</option>
            {(['beginner', 'intermediate', 'advanced', 'expert'] as CampaignLeague[]).map(
              (league) => (
                <option
                  key={league}
                  value={league}
                  disabled={!stats.unlockedLeagues.includes(league)}
                >
                  {league}
                  {!stats.unlockedLeagues.includes(league) ? ' (locked)' : ''}
                </option>
              ),
            )}
          </select>
        </Field>
      </section>

      <section>
        <h2 className="mb-3 text-sm tracking-[0.16em] text-[var(--fog-dim)] uppercase">
          AI roster · {totalPlayers} seats
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="border border-[var(--ember)] bg-[var(--panel)] px-3 py-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center text-sm font-bold text-[#0b1210]"
                style={{ background: AVATAR_COLORS['avatar-you'] }}
              >
                YOU
              </div>
              <div>
                <p className="font-semibold">You</p>
                <p className="text-xs text-[var(--fog-dim)]">Human · Seat 1</p>
              </div>
            </div>
          </article>
          {roster.map((ai, i) => (
            <article key={ai.id} className="border border-[var(--line)] bg-[var(--panel)] px-3 py-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center text-sm font-bold text-[#0b1210]"
                  style={{ background: AVATAR_COLORS[ai.avatarId] ?? '#5c7368' }}
                >
                  {avatarInitials(ai.name)}
                </div>
                <div>
                  <p className="font-semibold">{ai.name}</p>
                  <p className="text-xs text-[var(--fog-dim)]">
                    {ai.personality} · {ai.difficulty} · Seat {i + 2}
                  </p>
                  <p className="text-xs text-[var(--fog)]">{ai.flavor}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onStart}
          className="bg-[var(--ember)] px-6 py-4 font-semibold text-[#1a0f0a]"
        >
          Start night
        </button>
        {hasSave && (
          <button
            type="button"
            onClick={onResume}
            className="border border-[var(--fog)] px-6 py-4 font-semibold"
          >
            Resume last game
          </button>
        )}
        <button
          type="button"
          className="border border-[var(--line)] px-4 py-4 text-sm text-[var(--fog-dim)]"
          onClick={() => onChange({ ...DEFAULT_SOLO_CONFIG })}
        >
          Reset settings
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-[var(--fog)]">
      {label}
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">{label}</p>
      <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        {value}
      </p>
    </div>
  );
}
