// src/lib/ws.d.ts
export function initWebSocket(server: any): void;

export function sendToUser(
  userId: number | string,
  event: string,
  payload: unknown
): void;

export function sendToOrg(
  orgId: number | string,
  event: string,
  payload: unknown
): void;

export function sendToConversation(
  conversationId: string,
  event: string,
  payload: unknown
): void;

export const clients: Map<string, { ws: any; userId: number | string; role: string; orgId?: number | string; rooms: Set<string> }>;
