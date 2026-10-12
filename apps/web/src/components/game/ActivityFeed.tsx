'use client';

import type { ActivityEvent } from '@now/game-types';

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const recent = events.slice(-12).reverse();
  return (
    <section
      className="max-h-48 overflow-y-auto border border-[var(--line)] bg-[var(--panel)] px-3 py-2"
      aria-live="polite"
      aria-label="Table activity"
    >
      <p className="mb-2 text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">Live feed</p>
      {recent.length === 0 ? (
        <p className="text-sm text-[var(--fog-dim)]">Waiting for the first move…</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {recent.map((e) => (
            <li key={e.id} className="border-l-2 border-[var(--ember)] pl-2 text-[var(--fog)]">
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
