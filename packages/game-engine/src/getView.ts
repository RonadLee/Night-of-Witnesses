import type { Action, MatchPrivateView, MatchPublicView, PlayerMatchView } from '@now/game-types';
import { baseTicketsForRole } from './roles';
import type { MatchState } from './state';

function legalActions(state: MatchState, playerId: string): Action['type'][] {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return [];

  if (state.phase === 'role_assignment') {
    const current = state.players[state.currentSeat];
    if (current?.id === playerId && me.hand.length === 2) return ['keep_card'];
    return [];
  }

  if (state.phase === 'information') {
    const current = state.players[state.currentSeat];
    if (current?.id !== playerId) return [];
    if (!me.hasAnnounced) return ['announce_sighting'];
    if (!me.abilityUsed) {
      const abilities: Action['type'][] = ['skip_ability'];
      if (me.role === 'butler') abilities.push('use_butler');
      if (me.role === 'detective') abilities.push('use_detective');
      if (me.role === 'lawyer') abilities.push('use_lawyer');
      return abilities;
    }
    return [];
  }

  if (state.phase === 'discussion') {
    const list: Action['type'][] = ['end_discussion'];
    if (state.variant.speech === 'gestures-only') list.push('gesture');
    else if (!me.isSilenced) list.push('chat');
    // Detective may reveal mid-discussion for sudden Private Room
    if (me.role === 'detective' && !me.abilityUsed) list.push('use_detective');
    return list;
  }

  if (state.phase === 'voting' && !me.hasVoted) return ['cast_vote'];
  return [];
}

function playerStatus(state: MatchState, playerId: string): string {
  const p = state.players.find((x) => x.id === playerId);
  return p?.status ?? 'Waiting';
}

export function getView(state: MatchState, playerId: string): PlayerMatchView {
  const me = state.players.find((p) => p.id === playerId);
  const current = state.currentSeat >= 0 ? state.players[state.currentSeat] : null;

  let voteTallies: Record<string, number> | null = null;
  let revealedRoles: Record<string, import('@now/game-types').RoleId> | null = null;
  if (state.phase === 'result') {
    voteTallies = {};
    for (const [voterId, targetId] of Object.entries(state.votes)) {
      const voter = state.players.find((p) => p.id === voterId);
      // Reconstruct ballot weight from role base tickets (ignore post-scoring bonuses)
      const weight = Math.max(1, baseTicketsForRole(voter?.role ?? null));
      voteTallies[targetId] = (voteTallies[targetId] ?? 0) + weight;
    }
    revealedRoles = Object.fromEntries(
      state.players.filter((p) => p.role).map((p) => [p.id, p.role!]),
    );
  }

  const publicView: MatchPublicView = {
    phase: state.phase,
    round: state.round,
    maxRounds: state.variant.rounds,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      seatIndex: p.seatIndex,
      hasVoted: p.hasVoted,
      isSilenced: p.isSilenced,
      isLocked: p.isLocked,
      avatarId: p.avatarId,
      personality: p.personality,
      difficulty: p.difficulty,
      status: playerStatus(state, p.id),
      currentAction: p.currentAction,
      // Hide others' ticket weights mid-match (Merchant fingerprint). Self uses private.tickets.
      tickets:
        state.phase === 'result' || p.id === playerId
          ? p.tickets
          : 1,
      roleRevealed: p.roleRevealed,
    })),
    currentPlayerId: current?.id ?? null,
    phaseEndsAt: state.phaseEndsAt,
    sightings: state.sightings,
    abilityReveals: state.abilityReveals.filter(
      (r) => !r.privateTo || r.privateTo === playerId,
    ),
    chat: state.chat,
    activity: state.activity,
    passHistory: state.passHistory.map((h) => {
      const revealActual =
        state.phase === 'result' || h.fromPlayerId === playerId || h.toPlayerId === playerId;
      return {
        fromPlayerId: h.fromPlayerId,
        toPlayerId: h.toPlayerId,
        claimedRole: h.claimedRole,
        actualRole: revealActual ? h.actualRole : null,
        reason: h.reason,
      };
    }),
    lastPassAnimation: state.lastPassAnimation,
    voteTallies,
    winnerSide: state.winnerSide,
    privateRoomPlayerId: state.privateRoomPlayerId,
    lockedPlayerId: state.lockedPlayerId,
    revealedRoles,
    scores: state.scores,
    ticketBreakdown: state.phase === 'result' ? state.ticketBreakdown : null,
    variant: state.variant,
    guestRoomPeeked: state.guestRoomPeeked,
    aiReasoning: state.phase === 'result' ? state.aiReasoning : [],
    winningRoleIds: state.phase === 'result' ? state.winningRoleIds : [],
  };

  const privateView: MatchPrivateView = {
    role: me?.role ?? null,
    hand: me?.hand ?? [],
    myVote: me?.voteTargetId ?? null,
    guestRoomCard: null,
    butlerPeek: state.butlerPeeks[playerId] ?? null,
    detectiveNote:
      me?.role === 'detective' || state.phase === 'result' ? state.detectiveNote : null,
    legalActions: legalActions(state, playerId),
    suspicion: state.aiMinds[playerId]?.suspicion ?? {},
    tickets: me?.tickets ?? 1,
  };

  return { public: publicView, private: privateView };
}
