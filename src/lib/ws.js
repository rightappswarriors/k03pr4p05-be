import { WebSocketServer } from "ws";


const clients = new Map()

export function initWebSocket(server) {
    const wss = new WebSocketServer({ server, clientTracking: true })
    wss.on("connection", function connection(ws, request) {
        const clientIp = request.socket.remoteAddress
        if (process.env.NODE_ENV === "development") {
            console.log(`New client connected from ${clientIp}`)
        }
        ws.on("message", (message) => {
            const data = JSON.parse(message)

            if (data.type === "AUTH") {
                ws.userId = data.userId
                ws.type = data.role

                clients.set(String(data.userId), {
                    ws,
                    type: data.role
                })
                if (process.env.NODE_ENV === "development") {
                    console.log(`User ${data.userId} connected as ${data.role}`)
                }
            }

        })

        ws.on("error", (error) => {
            if (process.env.NODE_ENV === "development") {
                console.error("Websocket error:", error)
            }
        })
        ws.on('close', () => {
            if (ws.userId) {
                clients.delete(ws.userId)
            }
            if (process.env.NODE_ENV === "development") {
            
                console.log("Client disconnected")
            }
        })
        ws.on("pong", () => {
            ws.isAlive = true
        })

        ws.isAlive = true
    })

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                return ws.terminate()
            }

            ws.isAlive = false
            ws.ping()
        })
    }, 30000)

    wss.on('close', () => {
        clearInterval(interval)
    })
}

export { clients }


export function sendToUser(userId, payload) {
    const client = clients.get(String(userId))

    if (client?.ws?.readyState === 1) { // 1 = OPEN
        console.log("Sending WS payload to", userId, payload)
        client.ws.send(JSON.stringify(payload))
    } else {
        console.log("User not connected or socket closed", userId)
    }
}