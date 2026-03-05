import { WebSocketServer } from "ws";
const clients = new Map();
export function initWebSocket(server) {
    const wss = new WebSocketServer({ server, clientTracking: true });
    wss.on("connection", (ws, request) => {
        ws.on("message", (message) => {
            const data = JSON.parse(message);
            if (data.type === "AUTH") {
                ws.userId = data.userId;
                ws.type = data.role;
                clients.set(String(data.userId), {
                    ws,
                    type: data.role
                });
            }
        });
        ws.on("close", () => {
            if (ws.userId) {
                clients.delete(ws.userId);
            }
        });
        ws.on("pong", () => {
            ws.isAlive = true;
        });
        ws.isAlive = true;
    });
}
export { clients };
export function sendToUser(userId, payload) {
    const client = clients.get(String(userId));
    if (client?.ws?.readyState === 1) { // 1 = OPEN
        console.log("Sending WS payload to", userId, payload);
        client.ws.send(JSON.stringify(payload));
    }
    else {
        console.log("User not connected or socket closed", userId);
    }
}
