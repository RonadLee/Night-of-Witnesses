/** In-memory room code → roomId map (avoids public realtime room listing). */

const codeToRoomId = new Map<string, string>();
const roomIdToCode = new Map<string, string>();

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function registerRoom(code: string, roomId: string): string {
  const normalized = normalizeRoomCode(code) || roomId.slice(0, 6).toUpperCase();
  // Drop prior mapping for this room
  const prev = roomIdToCode.get(roomId);
  if (prev) codeToRoomId.delete(prev);
  codeToRoomId.set(normalized, roomId);
  roomIdToCode.set(roomId, normalized);
  return normalized;
}

export function unregisterRoom(roomId: string): void {
  const code = roomIdToCode.get(roomId);
  if (code) codeToRoomId.delete(code);
  roomIdToCode.delete(roomId);
}

export function resolveRoomId(code: string): string | null {
  const normalized = normalizeRoomCode(code);
  return codeToRoomId.get(normalized) ?? null;
}
