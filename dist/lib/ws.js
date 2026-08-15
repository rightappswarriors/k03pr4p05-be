// Portal BE WebSocket gateway — room-scoped, Redis-bridged, cross-app realtime
//
// FIXES applied (2026-08-15):
//   FIX 1 — Import `WebSocket` alongside `WebSocketServer`.
//            Previously only `WebSocketServer` was imported, so `WebSocket.OPEN`
//            resolved to `undefined`.  The guard in sendLocal()
//            (`client.ws.readyState === WebSocket.OPEN`) was therefore ALWAYS
//            false, meaning no message was ever delivered to any locally-
//            connected Portal client.  (Redis PUBLISH still ran, but local
//            delivery to Portal's own connected sockets was dead.)
//
//   FIX 2 — Log Redis errors explicitly instead of silently swallowing them.
//            The old `catch { publisher = undefined; }` buried connection
//            failures with zero output, making it impossible to diagnose
//            whether Redis was actually reachable.
//
//   FIX 3 — Retry the Redis bridge with exponential back-off.
//            If Redis is down at startup (or drops later), the bridge now
//            retries automatically rather than staying permanently broken.
//            Max back-off is capped at 30 seconds.
import { WebSocketServer, WebSocket } from "ws"; // FIX 1: added WebSocket
import jwt from "jsonwebtoken";
import { createClient } from "redis";
// Keyed by a unique per-connection socket id, NOT by userId.
// This prevents the reconnect bug where a closing socket's `close` handler
// would delete a new connection's entry for the same user.
const clients = new Map();
const bridgeId = `portal-${process.pid}-${Math.random().toString(36).slice(2)}`;
let publisher;
let _bridgeRetryMs = 1000; // FIX 3: back-off state
async function connectBridge() {
    try {
        const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
        publisher = createClient({ url: redisUrl });
        const subscriber = publisher.duplicate();
        // FIX 2: surface Redis errors instead of swallowing them
        publisher.on("error", (err) => console.error("[PortalWebSocket] Redis publisher error:", err.message));
        subscriber.on("error", (err) => console.error("[PortalWebSocket] Redis subscriber error:", err.message));
        await Promise.all([publisher.connect(), subscriber.connect()]);
        // FIX 3: reset back-off after a successful connection
        _bridgeRetryMs = 1000;
        console.log(`[PortalWebSocket] Redis bridge connected (${redisUrl})`);
        await subscriber.subscribe("kompra:realtime", (raw) => {
            try {
                const message = JSON.parse(raw);
                if (message.source !== bridgeId) {
                    if (process.env.NODE_ENV === "development") {
                        console.log(`[PortalWebSocket] REDIS RECEIVE room=${message.room} event=${message.event}`);
                    }
                    emitLocal(message.room, message.event, message.payload);
                }
            }
            catch { }
        });
        // FIX 3: if the publisher disconnects unexpectedly, reconnect with back-off
        publisher.on("end", () => {
            console.warn("[PortalWebSocket] Redis bridge disconnected — will reconnect…");
            publisher = undefined;
            scheduleReconnect();
        });
    }
    catch (err) {
        // FIX 2: always log the reason
        console.error("[PortalWebSocket] Redis bridge connect failed:", err?.message ?? err);
        publisher = undefined;
        // FIX 3: retry with exponential back-off
        scheduleReconnect();
    }
}
function scheduleReconnect() {
    const delay = _bridgeRetryMs;
    _bridgeRetryMs = Math.min(_bridgeRetryMs * 2, 30_000); // cap at 30 s
    console.warn(`[PortalWebSocket] Retrying Redis bridge in ${delay}ms…`);
    setTimeout(() => void connectBridge(), delay);
}
export function initWebSocket(server) {
    void connectBridge();
    const wss = new WebSocketServer({ server, clientTracking: true });
    wss.on("connection", function connection(ws, request) {
        const url = new URL(request.url || "/", "http://localhost");
        const token = url.searchParams.get("token");
        let claims;
        try {
            claims = jwt.verify(token, process.env.JWT_SECRET || "token");
        }
        catch {
            ws.close(1008, "Unauthorized");
            return;
        }
        if (!claims?.userId) {
            ws.close(1008, "Unauthorized");
            return;
        }
        const userIdKey = String(claims.userId);
        const clientId = `${userIdKey}#${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        const client = {
            ws,
            clientId,
            userId: claims.userId,
            role: claims.role,
            orgId: claims.orgId,
            rooms: new Set(),
        };
        // Always join user room for direct 1:1 messages
        client.rooms.add(`user:${userIdKey}`);
        // Join org room if JWT contains orgId
        if (claims.orgId != null)
            client.rooms.add(`org:${claims.orgId}`);
        clients.set(clientId, client);
        if (process.env.NODE_ENV === "development") {
            console.log(`[PortalWebSocket] CONNECTED user:${userIdKey} clientId:${clientId} role=${claims.role} orgId=${claims.orgId} rooms=${[...client.rooms].join(",")}`);
        }
        ws.on("message", (message) => {
            let data;
            try {
                data = JSON.parse(message);
            }
            catch {
                return;
            }
            // AUTH frame — identity is derived from JWT, but allow client to refresh org context
            if (data.type === "AUTH" || data.event === "socket:auth") {
                // Identity already set from JWT; only allow upgrading orgId if JWT lacked it
                if (!claims.orgId && data.orgId != null) {
                    claims.orgId = data.orgId;
                    client.orgId = data.orgId;
                    client.rooms.add(`org:${data.orgId}`);
                }
                send(ws, "socket:ready", { rooms: [...client.rooms] });
                return;
            }
            // Room management — join/leave conversation rooms
            const evt = data.event || data.type;
            if ((evt === "conversation:join" || evt === "join") && data.conversationId) {
                const room = `conversation:${data.conversationId}`;
                client.rooms.add(room);
                if (process.env.NODE_ENV === "development")
                    console.log(`[PortalWebSocket] JOIN ${room} user:${userIdKey}`);
                return;
            }
            if ((evt === "conversation:leave" || evt === "leave") && data.conversationId) {
                const room = `conversation:${data.conversationId}`;
                client.rooms.delete(room);
                if (process.env.NODE_ENV === "development")
                    console.log(`[PortalWebSocket] LEAVE ${room} user:${userIdKey}`);
                return;
            }
            // Ephemeral events (typing, presence) — relay only within the same conversation or org
            if (["typing:start", "typing:stop", "conversation:typing", "conversation:messageRead", "presence:update"].includes(evt)) {
                const room = data.conversationId ? `conversation:${data.conversationId}` : `org:${client.orgId}`;
                const payload = data.payload || {};
                emit(room, "conversation:typing", { ...payload, senderOrgId: client.orgId, senderId: client.userId });
            }
        });
        ws.on("error", (error) => {
            if (process.env.NODE_ENV === "development") {
                console.error("[PortalWebSocket] Socket error:", error);
            }
        });
        ws.on("close", () => {
            // Only delete THIS specific connection's entry, not any other connection
            // for the same user that may have been created by a reconnect.
            clients.delete(clientId);
            if (process.env.NODE_ENV === "development")
                console.log(`[PortalWebSocket] DISCONNECTED user:${userIdKey} clientId:${clientId}`);
        });
        ws.on("pong", () => { ws.isAlive = true; });
        // Send ready frame immediately so client knows it's authenticated
        send(ws, "socket:ready", { rooms: [...client.rooms], userId: claims.userId });
        ws.isAlive = true;
    });
    // Ping/pong keep-alive
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false)
                return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);
    wss.on("close", () => clearInterval(interval));
}
export { clients };
function send(ws, event, payload) {
    if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ event, payload }));
}
function sendLocal(room, event, payload) {
    // Iterate over a snapshot of entries to avoid mutation-during-iteration.
    // Do NOT delete clients here — stale sockets should only be cleaned
    // via the `ws.on("close")` handler with the correct clientId key.
    for (const client of clients.values()) {
        // FIX 1: WebSocket is now properly imported, so WebSocket.OPEN === 1.
        // Previously this guard was always false because WebSocket was undefined.
        if (client.rooms.has(room) && client.ws.readyState === WebSocket.OPEN) {
            send(client.ws, event, payload);
        }
    }
}
function emitLocal(room, event, payload) {
    sendLocal(room, event, payload);
}
function emit(room, event, payload) {
    // Deliver locally to all matching clients
    sendLocal(room, event, payload);
    // Publish to Redis so the other gateway can deliver cross-app
    if (publisher?.isOpen) {
        if (process.env.NODE_ENV === "development") {
            console.log(`[PortalWebSocket] REDIS PUBLISH room=${room} event=${event}`);
        }
        void publisher.publish("kompra:realtime", JSON.stringify({ source: bridgeId, room, event, payload }));
    }
    else if (process.env.NODE_ENV === "development") {
        // FIX 2: warn when Redis is down so the developer can see cross-app delivery is blocked
        console.warn(`[PortalWebSocket] Redis not connected — cross-app publish skipped for room=${room} event=${event}`);
    }
}
export function sendToUser(userId, event, payload) {
    const userIdKey = String(userId);
    if (process.env.NODE_ENV === "development")
        console.log(`[PortalWebSocket] sendToUser user:${userIdKey} event=${event}`);
    emit(`user:${userIdKey}`, event, payload);
}
export function sendToOrg(orgId, event, payload) {
    if (process.env.NODE_ENV === "development")
        console.log(`[PortalWebSocket] sendToOrg org:${orgId} event=${event}`);
    emit(`org:${orgId}`, event, payload);
}
export function sendToConversation(conversationId, event, payload) {
    if (process.env.NODE_ENV === "development")
        console.log(`[PortalWebSocket] sendToConversation conversation:${conversationId} event=${event}`);
    emit(`conversation:${conversationId}`, event, payload);
}
