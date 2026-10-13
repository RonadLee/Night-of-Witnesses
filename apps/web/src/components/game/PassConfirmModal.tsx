'use client';

import { useState } from 'react';
import type { RoleId } from '@now/game-types';
import { ALL_ROLE_IDS, roleLabel } from '@/lib/roleLabels';
import { RoleCardArt } from '@/components/game/RoleCardArt';
import { useI18n } from '@/i18n';

interface Props {
  card: RoleId;
  passToName: string;
  passToId: string;
  players: Array<{ id: string; name: string }>;
  onConfirm: (payload: { claimedRole: RoleId; reason: string; passToId: string }) => void;
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
  const { t } = useI18n();
  const [claimedRole, setClaimedRole] = useState<RoleId>(card);
  const [toId, setToId] = useState(passToId);
  const [submitting, setSubmitting] = useState(false);

  const toName =
    toId === 'guest_room'
      ? t.game.guestRoom
      : (players.find((p) => p.id === toId)?.name ?? passToName);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pass-confirm-title"
    >
      <form
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[var(--line)] bg-[var(--bg-mist)] p-5 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (submitting) return;
          setSubmitting(true);
          const fd = new FormData(e.currentTarget);
          onConfirm({
            claimedRole,
            reason: String(fd.get('reason') ?? '').trim(),
            passToId: String(fd.get('passTo') ?? toId),
          });
        }}
      >
        <h3
          id="pass-confirm-title"
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t.game.confirmPass}
        </h3>

        <div className="mt-4">
          <p className="text-sm text-[var(--fog)]">{t.game.actualCard}</p>
          <div className="mt-2 flex items-start gap-3">
            <RoleCardArt role={card} size="md" preview />
            <p className="text-sm text-[var(--fog-dim)]">
              Only you (and the recipient after the pass) know this is the real card. The table sees
              your claim instead.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm text-[var(--fog)]">{t.game.claimCard}</p>
          <p className="text-xs text-[var(--fog-dim)]">{t.game.claimHint}</p>
          <div className="mt-2 grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
            {ALL_ROLE_IDS.map((r) => (
              <RoleCardArt
                key={r}
                role={r}
                size="xs"
                selected={claimedRole === r}
                preview={false}
                onClick={() => setClaimedRole(r)}
              />
            ))}
          </div>
          <p className="mt-2 text-sm">
            {t.game.claiming}: <strong>{roleLabel(claimedRole)}</strong>
            {claimedRole !== card ? (
              <span className="ml-2 text-[var(--ember-hot)]">({t.game.bluff})</span>
            ) : (
              <span className="ml-2 text-[var(--fog-dim)]">({t.game.truth})</span>
            )}
          </p>
        </div>

        <label className="mt-4 flex flex-col gap-1 text-sm text-[var(--fog)]">
          {t.game.recipient}
          <select
            name="passTo"
            className="field"
            value={toId}
            disabled={!allowSelectPassTo}
            onChange={(e) => setToId(e.target.value)}
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--fog-dim)]">
            Pass chain target: {toName}. Engine still follows seat order; claim is what they hear.
          </span>
        </label>

        <label className="mt-4 flex flex-col gap-1 text-sm text-[var(--fog)]">
          {t.game.reasonOptional}
          <textarea name="reason" rows={2} maxLength={120} className="field" />
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-[var(--ember)] px-4 py-3 font-semibold text-[#1a0f0a] disabled:opacity-60"
          >
            {t.game.confirmPass}
          </button>
          <button
            type="button"
            className="flex-1 border border-[var(--line)] px-4 py-3"
            onClick={onCancel}
          >
            {t.game.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
