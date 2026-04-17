// src/lib/ws.d.ts
export function initWebSocket(server: any): void;

export function sendToUser(
  userId: number | string,
  payload: Record<string, any>
): void;

export const clients: Map<string, { ws: any; type: string }>;