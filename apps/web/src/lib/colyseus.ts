export function gameServerUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? 'ws://localhost:2567';
  }
  return process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? `ws://${window.location.hostname}:2567`;
}

export function gameServerHttpUrl(): string {
  const ws = gameServerUrl();
  if (ws.startsWith('wss://')) return `https://${ws.slice('wss://'.length)}`;
  if (ws.startsWith('ws://')) return `http://${ws.slice('ws://'.length)}`;
  return ws;
}
