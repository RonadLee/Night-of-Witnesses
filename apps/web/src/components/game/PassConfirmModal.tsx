'use client';

import type { RoleId } from '@now/game-types';
import { roleLabel } from '@/lib/roleLabels';

interface Props {
  card: RoleId;
  passToName: string;
  passToId: string;
  players: Array<{ id: string; name: string }>;
  onConfirm: (reason: string, passToId: string) => void;
  onCancel: () => void;
  allowSelectPassTo?: boolean;
}

export function PassConfirmModal({
  card,
  passToName,
  passToId,
  players,
  onConfirm,
  onCancel,
  allowSelectPassTo = false,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pass-confirm-title"
    >
      <form
        className="w-full max-w-md border border-[var(--line)] bg-[var(--bg-mist)] p-5 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onConfirm(String(fd.get('reason') ?? '').trim(), String(fd.get('passTo') ?? passToId));
        }}
      >
        <h3
          id="pass-confirm-title"
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Confirm pass
        </h3>
        <p className="mt-4 text-sm text-[var(--fog)]">Selected Card</p>
        <p className="text-lg font-semibold text-[var(--ember-hot)]">{roleLabel(card)}</p>

        <label className="mt-4 flex flex-col gap-1 text-sm text-[var(--fog)]">
          Pass To
          <select
            name="passTo"
            className="field"
            defaultValue={passToId}
            disabled={!allowSelectPassTo}
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--fog-dim)]">
            Pass &quot;{roleLabel(card)}&quot; card to {passToName}.
          </span>
        </label>

        <label className="mt-4 flex flex-col gap-1 text-sm text-[var(--fog)]">
          Reason (optional)
          <textarea
            name="reason"
            rows={2}
            maxLength={120}
            className="field"
            placeholder="Why this card?"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-[var(--ember)] px-4 py-3 font-semibold text-[#1a0f0a]"
          >
            Confirm
          </button>
          <button
            type="button"
            className="flex-1 border border-[var(--line)] px-4 py-3"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
