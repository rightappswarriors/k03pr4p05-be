import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { makeSchema, plugin } from "nexus";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import cookieParser from "cookie-parser";
// Import Node.js built-in modules for path resolution in ES modules
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "redis"; // 👈 ADD THIS
// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { prisma } from "./lib/prisma.js";
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "token";
import { DateTimeScalar, JsonScalar } from './lib/scalars.js';
// import { ValueNode, Kind } from "graphql";
// OutletPromo
// import * as OutletPromo from "./graphql/typeDefs/outletPromo.type.js"
import http from "http";
import { initWebSocket } from "./lib/ws.js";
// PromoType
import * as Resolvers from "./graphql/resolvers/index.js";
import * as TypeDefs from "./graphql/typeDefs/index.js";
// Import BullMQ worker
import './workers/restock.worker.js';
export const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379"
});
redisClient.on("error", (err) => console.error("Redis error:", err));
redisClient.on("connect", () => console.log("✅ Redis connected"));
await redisClient.connect();
const schema = makeSchema({
    types: [
        // Correctly unpack the individual types from the imported modules
        DateTimeScalar,
        JsonScalar,
        ...Object.values(Resolvers),
        ...Object.values(TypeDefs),
    ],
    plugins: [
        plugin({
            name: "missingTypeLogger",
            onMissingType(typeName) {
                console.error("[NEXUS MISSING TYPE]", typeName);
            },
        }),
    ],
    outputs: {
        // This will generate `schema.graphql` and `nexus-typegen.ts`
        // Now using the correct path resolution for ES modules
        schema: join(__dirname, "generated", "schema.graphql"),
        typegen: join(__dirname, "generated", "nexus-typegen.ts"),
    },
});
// Simple check for missing types (development only)
// ====== Debugging helper: log all types ======
if (process.env.NODE_ENV === "development") {
    const typeMap = schema.getTypeMap();
    console.log("✅ All GraphQL types:");
    Object.keys(typeMap).forEach((t) => console.log("  -", t));
}
// 3. Initialize Apollo server with the generated schema
async function startApolloServer() {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    const server = new ApolloServer({
        schema,
    });
    await server.start();
    const allowedOrigins = process.env.NODE_ENV === "production"
        ? [process.env.FRONTEND_URL]
        : [
            "http://localhost:4000",
            "exp+pos-vine-mman://expo-development-client/?url=https%3A%2F%2Fcb04bpw-nuelgrace-8081.exp.direct",
            "http://192.168.254.254:8081",
            "exp://192.168.254.254:8081",
            "http://192.168.254.125:4000",
            "exp://192.168.254.125:8081",
        ];
    app.use("/graphql", cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    }), expressMiddleware(server, {
        context: async ({ req, res }) => {
            const authHeader = req.headers["authorization"];
            //console.log("Auth Header:", authHeader);
            const token = authHeader?.split(" ")[1];
            let user = null;
            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    if (decoded.userId) {
                        // Fetch current user data from database to ensure we have latest info
                        user = await prisma.user.findUnique({
                            where: { id: decoded.userId },
                            select: {
                                id: true,
                                role: true,
                                email: true,
                                orgId: true,
                                isVerified: true,
                                fullname: true,
                                username: true,
                                isOwner: true,
                                position: true,
                            }
                        });
                        // Add userId for backward compatibility
                        if (user) {
                            user.userId = user.id;
                        }
                    }
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development") {
                        if (error.name === "TokenExpiredError") {
                            console.warn("Access token expired");
                        }
                        else {
                            console.error("JWT verification failed:", error.message);
                        }
                    }
                }
            }
            // Pass the Prisma Client to the context so it's available in your resolvers
            return {
                prisma,
                redisClient,
                user,
                req,
                res,
            };
        },
    }));
    const PORT = Number(process.env.PORT) || 4000;
    const httpServer = http.createServer(app);
    // initialize websocket
    initWebSocket(httpServer);
    httpServer.listen(PORT, "0.0.0.0", () => {
        if (process.env.NODE_ENV === "development") {
            console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
            console.log(`🔌 WebSocket server ready`);
        }
    });
}
startApolloServer();
