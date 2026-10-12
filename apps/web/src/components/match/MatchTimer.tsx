'use client';

interface MatchTimerProps {
  phaseEndsAt: number | null;
  now: number;
  phaseLabel: string;
  warningSeconds?: number;
}

export function MatchTimer({
  phaseEndsAt,
  now,
  phaseLabel,
  warningSeconds = 10,
}: MatchTimerProps) {
  if (phaseEndsAt == null) {
    return (
      <div className="match-timer" aria-live="polite">
        <p className="text-xs tracking-[0.16em] text-[var(--fog-dim)] uppercase">{phaseLabel}</p>
        <p className="text-2xl font-bold text-[var(--fog)]">—</p>
      </div>
    );
  }
  const remainingMs = Math.max(0, phaseEndsAt - now);
  const totalShown = Math.ceil(remainingMs / 1000);
  const m = Math.floor(totalShown / 60);
  const s = totalShown % 60;
  const urgent = totalShown <= warningSeconds;

  return (
    <div
      className={`match-timer ${urgent ? 'match-timer-urgent' : ''}`}
      aria-live="polite"
      aria-label={`${phaseLabel} timer ${m}:${s.toString().padStart(2, '0')}`}
    >
      <p className="text-xs tracking-[0.16em] text-[var(--fog-dim)] uppercase">{phaseLabel}</p>
      <p
        className={`text-3xl font-bold tabular-nums ${
          urgent ? 'text-[var(--danger)]' : 'text-[var(--ember-hot)]'
        }`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {m}:{s.toString().padStart(2, '0')}
      </p>
    </div>
  );
}
