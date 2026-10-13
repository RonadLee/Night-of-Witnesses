export function gameServerUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? 'ws://localhost:2567';
  }
  return process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? `ws://${window.location.hostname}:2567`;
}

/** HTTP origin for game-server REST helpers (room resolve). */
export function gameServerHttpUrl(): string {
  const ws = gameServerUrl();
  if (ws.startsWith('wss://')) return `https://${ws.slice(6)}`;
  if (ws.startsWith('ws://')) return `http://${ws.slice(5)}`;
  if (ws.startsWith('https://') || ws.startsWith('http://')) return ws;
  return `http://${ws}`;
}

const CREDS_KEY = 'now_mp_creds';

export interface MultiplayerCreds {
  playerId: string;
  reconnectToken: string;
  roomId?: string;
  code?: string;
}

export function loadMultiplayerCreds(): MultiplayerCreds | null {
  try {
    const raw = sessionStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MultiplayerCreds;
    if (
      typeof parsed.playerId === 'string' &&
      typeof parsed.reconnectToken === 'string' &&
      parsed.playerId &&
      parsed.reconnectToken
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveMultiplayerCreds(creds: MultiplayerCreds): void {
  sessionStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}

export function clearMultiplayerCreds(): void {
  sessionStorage.removeItem(CREDS_KEY);
}
