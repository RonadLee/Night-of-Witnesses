export function gameServerUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? 'ws://localhost:2567';
  }
  return process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? `ws://${window.location.hostname}:2567`;
}
