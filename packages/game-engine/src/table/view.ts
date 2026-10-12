import type {
  BoilerRole,
  TableActionType,
  TablePlayerView,
  TablePrivateView,
  TablePublicPlayer,
  TablePublicView,
} from '@now/game-types';
import { PASS_TURN_MS } from './settings';
import { expectedTarget } from './applyTable';
import type { TableState } from './state';

function seesSecrets(state: TableState): boolean {
  return state.phase === 'result' || state.phase === 'ended';
}

function legalFor(state: TableState, playerId: string): TableActionType[] {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return [];
  const current = state.players.find((p) => p.seatIndex === state.currentSeat);
  if (state.phase === 'passing' && current?.id === playerId && me.hand.length === 2) {
    return ['confirm_pass'];
  }
  if (state.phase === 'description' && current?.id === playerId && me.description === null) {
    return ['save_draft', 'submit_description'];
  }
  if (state.phase === 'discussion') {
    const list: TableActionType[] = ['chat', 'react'];
    if (me.role === 'butler' && !state.departedPublic) list.push('butler_reveal');
    if (me.role === 'detective' && !state.detectiveUsed) list.push('detective_lock');
    return list;
  }
  if (state.phase === 'voting' && me.canVote && !me.hasVoted) return ['cast_vote'];
  if ((state.phase === 'result' || state.phase === 'ended') && state.chat.length > 0) return ['react'];
  return [];
}

export function getTableView(state: TableState, playerId: string | null): TablePlayerView {
  const me = playerId ? state.players.find((p) => p.id === playerId) : undefined;
  const current = state.players.find((p) => p.seatIndex === state.currentSeat) ?? null;
  const revealed = seesSecrets(state);
  const target = expectedTarget(state);

  const players: TablePublicPlayer[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    seatIndex: p.seatIndex,
    connected: p.connected,
    hasVoted: p.hasVoted,
    hasDescribed: p.description !== null,
    canVote: p.canVote,
    isCurrent: current?.id === p.id,
    typing: p.typing,
  }));

  const roles: Record<string, BoilerRole> | null = revealed
    ? Object.fromEntries(state.players.filter((p) => p.role).map((p) => [p.id, p.role!]))
    : null;

  const publicView: TablePublicView = {
    phase: state.phase,
    round: state.round,
    maxRounds: state.settings.rounds,
    players,
    currentPlayerId: current?.id ?? null,
    phaseEndsAt: state.phaseEndsAt,
    passTurnMs: PASS_TURN_MS,
    activity: state.activity,
    chat: state.chat,
    descriptions: state.players
      .filter((p) => p.description !== null)
      .map((p) => ({ playerId: p.id, text: p.description ?? '', at: 0 })),
    passes: state.passes,
    departedGuests: state.departedPublic || revealed ? [...state.departedGuests] : null,
    winner: revealed ? state.winner : null,
    lockedPlayerId: revealed ? state.lockedPlayerId : null,
    scores: state.scores,
    voteTotals: revealed ? (state.resolution?.voteTotals ?? {}) : null,
    voteBreakdown:
      revealed && !state.settings.anonymousVoting ? (state.resolution?.ballots ?? []) : null,
    abilityNotes: revealed ? (state.resolution?.abilityNotes ?? []) : [],
    revealedRoles: roles,
    unseatedCard: revealed ? state.unseatedCard : null,
    anonymousVoting: state.settings.anonymousVoting,
    previousRounds: state.previousRounds,
    settings: state.settings,
  };

  const butlerVision =
    me?.role === 'butler' || (me?.hand.includes('butler') ?? false) ? [...state.departedGuests] : null;

  const hostCommands: TablePrivateView['hostCommands'] = [];
  if (me && me.id === state.hostPlayerId && (state.phase === 'result' || state.phase === 'ended')) {
    if (state.phase === 'result' && state.round < state.settings.rounds) hostCommands.push('next_round');
    hostCommands.push('return_lobby', 'end_game');
  }

  const privateView: TablePrivateView = {
    spectator: !me,
    role: revealed ? (me?.role ?? null) : (me?.role ?? null),
    hand: me?.hand ?? [],
    draft: me?.draft ?? '',
    description: me?.description ?? null,
    myVote: me?.voteTargetId ?? null,
    departedGuests: butlerVision ?? (state.departedPublic || revealed ? [...state.departedGuests] : null),
    passTarget:
      me && target && current?.id === me.id
        ? {
            playerId: target.kind === 'unseated' ? null : (target.player?.id ?? null),
            name: target.kind === 'unseated' ? 'Set aside' : (target.player?.name ?? 'Player'),
            available: target.kind === 'unseated' ? true : Boolean(target.player?.connected),
          }
        : null,
    legalActions: me ? legalFor(state, me.id) : [],
    hostCommands,
  };

  if (!revealed) privateView.role = me?.role ?? null;

  return { public: publicView, private: privateView };
}
