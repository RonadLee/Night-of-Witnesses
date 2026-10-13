'use client';

import type { PublicPlayerView } from '@now/game-types';
import { AVATAR_COLORS, avatarInitials } from '@/lib/solo/avatars';

interface CircularTableProps {
  players: PublicPlayerView[];
  selfId: string;
  currentPlayerId: string | null;
  dropEnabled: boolean;
  voteEnabled: boolean;
  dragOverSeatId: string | null;
  onSeatDrop: (seatPlayerId: string) => void;
  onSeatDragOver: (seatPlayerId: string | null) => void;
  onSeatClick: (seatPlayerId: string) => void;
}

export function CircularTable({
  players,
  selfId,
  currentPlayerId,
  dropEnabled,
  voteEnabled,
  dragOverSeatId,
  onSeatDrop,
  onSeatDragOver,
  onSeatClick,
}: CircularTableProps) {
  const n = Math.max(players.length, 1);

  return (
    <div className="circular-table-wrap" aria-label="Game table">
      <div className="circular-table-felt" aria-hidden>
        <div className="circular-table-center">
          <span>Night of</span>
          <strong>Witnesses</strong>
        </div>
      </div>
      {players.map((p, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const radius = 42; // % of container
        const x = 50 + Math.cos(angle) * radius;
        const y = 50 + Math.sin(angle) * radius;
        const color = AVATAR_COLORS[p.avatarId] ?? '#5c7368';
        const isCurrent = currentPlayerId === p.id;
        const isDrop = dragOverSeatId === p.id;
        const interactive = (dropEnabled && p.id !== selfId) || voteEnabled;

        return (
          <button
            key={p.id}
            type="button"
            className={[
              'circular-seat',
              isCurrent ? 'circular-seat-current' : '',
              isDrop ? 'circular-seat-drop' : '',
              p.isLocked ? 'circular-seat-locked' : '',
              interactive ? 'circular-seat-interactive' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={() => onSeatClick(p.id)}
            onDragOver={(e) => {
              if (!dropEnabled || p.id === selfId) return;
              e.preventDefault();
              onSeatDragOver(p.id);
            }}
            onDragLeave={() => onSeatDragOver(null)}
            onDrop={(e) => {
              if (!dropEnabled || p.id === selfId) return;
              e.preventDefault();
              onSeatDragOver(null);
              onSeatDrop(p.id);
            }}
          >
            <div className="circular-seat-avatar" style={{ background: color }} aria-hidden>
              {avatarInitials(p.name)}
            </div>
            <div className="circular-seat-meta">
              <p className="circular-seat-name">
                {p.name}
                {p.id === selfId ? ' (you)' : ''}
              </p>
              <p className="circular-seat-status">{p.status}</p>
              {p.currentAction && (
                <p className="circular-seat-action">{p.currentAction}</p>
              )}
              <div className="circular-seat-flags">
                {p.hasVoted && <span>Voted</span>}
                {p.isSilenced && <span>Silenced</span>}
                {p.isLocked && <span>Locked</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
