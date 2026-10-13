import type { Action, RoleId } from '@now/game-types';

const ROLE_IDS = new Set<RoleId>([
  'murderer',
  'accomplice',
  'bomber',
  'butler',
  'detective',
  'merchant',
  'lawyer',
  'guest_yellow',
  'guest_blue',
  'guest_red',
]);

const ACTION_TYPES = new Set<Action['type']>([
  'keep_card',
  'announce_sighting',
  'skip_ability',
  'use_butler',
  'use_detective',
  'use_lawyer',
  'chat',
  'gesture',
  'end_discussion',
  'cast_vote',
]);

const GESTURE_IDS = new Set([
  'accuse',
  'defend',
  'doubt',
  'agree',
  'pass',
  'think',
  'quiet',
  'point',
]);

const MAX_TEXT = 280;
const MAX_ID = 64;

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function clampText(v: unknown, max = MAX_TEXT): string | null {
  if (!isString(v)) return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
}

function asId(v: unknown): string | null {
  if (!isString(v)) return null;
  const t = v.trim().slice(0, MAX_ID);
  return t.length ? t : null;
}

function asRole(v: unknown): RoleId | null {
  if (!isString(v) || !ROLE_IDS.has(v as RoleId)) return null;
  return v as RoleId;
}

/** Runtime-validate client action payloads before they hit the engine. */
export function validateAction(raw: unknown): { ok: true; action: Action } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid action' };
  const msg = raw as Record<string, unknown>;
  const type = msg.type;
  if (!isString(type) || !ACTION_TYPES.has(type as Action['type'])) {
    return { ok: false, error: 'Unknown action' };
  }

  switch (type as Action['type']) {
    case 'keep_card': {
      const keepIndex = msg.keepIndex;
      if (keepIndex !== 0 && keepIndex !== 1) return { ok: false, error: 'Invalid keep index' };
      let claimedRole: RoleId | undefined;
      if (msg.claimedRole !== undefined) {
        const role = asRole(msg.claimedRole);
        if (!role) return { ok: false, error: 'Invalid claimed role' };
        claimedRole = role;
      }
      const passReason =
        msg.passReason === undefined ? undefined : (clampText(msg.passReason) ?? undefined);
      return {
        ok: true,
        action: {
          type: 'keep_card',
          keepIndex,
          claimedRole,
          passReason,
        },
      };
    }
    case 'announce_sighting': {
      const claimedRole = asRole(msg.claimedRole);
      const claimedThroughPlayerId = asId(msg.claimedThroughPlayerId);
      const text = clampText(msg.text) ?? '';
      if (!claimedRole || !claimedThroughPlayerId) {
        return { ok: false, error: 'Invalid sighting' };
      }
      return {
        ok: true,
        action: { type: 'announce_sighting', claimedRole, claimedThroughPlayerId, text },
      };
    }
    case 'skip_ability':
      return { ok: true, action: { type: 'skip_ability' } };
    case 'use_butler': {
      const targetA = asId(msg.targetA);
      const targetB = asId(msg.targetB);
      if (!targetA || !targetB) return { ok: false, error: 'Invalid targets' };
      return { ok: true, action: { type: 'use_butler', targetA, targetB } };
    }
    case 'use_detective':
    case 'use_lawyer':
    case 'cast_vote': {
      const targetPlayerId = asId(msg.targetPlayerId);
      if (!targetPlayerId) return { ok: false, error: 'Invalid target' };
      return { ok: true, action: { type, targetPlayerId } as Action };
    }
    case 'chat': {
      const text = clampText(msg.text);
      if (!text) return { ok: false, error: 'Empty chat' };
      return { ok: true, action: { type: 'chat', text } };
    }
    case 'gesture': {
      const gestureId = asId(msg.gestureId);
      if (!gestureId || !GESTURE_IDS.has(gestureId)) {
        return { ok: false, error: 'Invalid gesture' };
      }
      return { ok: true, action: { type: 'gesture', gestureId } };
    }
    case 'end_discussion':
      return { ok: true, action: { type: 'end_discussion' } };
    default:
      return { ok: false, error: 'Unknown action' };
  }
}
