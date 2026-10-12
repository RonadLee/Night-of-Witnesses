'use client';

import type { ActivityEvent, PlayerMatchView } from '@now/game-types';

interface MatchChatProps {
  view: PlayerMatchView;
  selfId: string;
  canChat: boolean;
  onSend: (text: string) => void;
}

export function MatchChat({ view, selfId, canChat, onSend }: MatchChatProps) {
  const pub = view.public;
  const events: Array<{ id: string; at: number; line: string; kind: string }> = [
    ...pub.activity.map((e: ActivityEvent) => ({
      id: e.id,
      at: e.at,
      line: e.message,
      kind: e.kind,
    })),
    ...pub.chat.map((c, i) => ({
      id: `chat-${i}-${c.at}`,
      at: c.at,
      line: `${nameOf(pub, c.fromPlayerId)}: ${c.text}`,
      kind: 'chat',
    })),
  ]
    .sort((a, b) => a.at - b.at)
    .slice(-40);

  return (
    <section className="match-chat border border-[var(--line)] bg-[var(--panel)]">
      <header className="border-b border-[var(--line)] px-3 py-2">
        <p className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
          Table chat & activity
        </p>
      </header>
      <div className="match-chat-scroll max-h-48 space-y-1.5 overflow-y-auto px-3 py-2 text-sm">
        {events.length === 0 ? (
          <p className="text-[var(--fog-dim)]">Waiting for the first move…</p>
        ) : (
          events.map((e) => (
            <p
              key={e.id}
              className={
                e.kind === 'chat'
                  ? 'text-[var(--paper)]'
                  : 'border-l-2 border-[var(--ember)] pl-2 text-[var(--fog)]'
              }
            >
              {e.line}
            </p>
          ))
        )}
      </div>
      {canChat && (
        <form
          className="flex gap-2 border-t border-[var(--line)] p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const text = String(fd.get('text') ?? '').trim();
            if (text) onSend(text);
            e.currentTarget.reset();
          }}
        >
          <input
            name="text"
            className="field flex-1 !py-2"
            placeholder={
              pub.players.find((p) => p.id === selfId)?.isSilenced
                ? 'You are silenced…'
                : 'Say something…'
            }
            maxLength={280}
            disabled={Boolean(pub.players.find((p) => p.id === selfId)?.isSilenced)}
          />
          <button type="submit" className="border border-[var(--line)] px-3 py-2 text-sm">
            Send
          </button>
        </form>
      )}
    </section>
  );
}

function nameOf(pub: PlayerMatchView['public'], id: string): string {
  return pub.players.find((p) => p.id === id)?.name ?? id;
}
