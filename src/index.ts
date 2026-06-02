import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { makeSchema, plugin } from "nexus";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "redis";
import jwt from "jsonwebtoken";
import http from "http";

import { prisma } from "./lib/prisma.js";
import { DateTimeScalar, JsonScalar } from "./lib/scalars.js";
import { initWebSocket } from "./lib/ws.js";
import * as Resolvers from "./graphql/resolvers/index.js";
import * as TypeDefs from "./graphql/typeDefs/index.js";
import { isRedisEnabled } from "./queue/restock.queue.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || "token";

export let redisClient: ReturnType<typeof createClient> | null = null;

if (isRedisEnabled) {
  redisClient = createClient({
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  });
  redisClient.on("error", (err) => console.error("Redis error:", err));
  redisClient.on("connect", () => console.log("Redis connected"));
  await redisClient.connect();
} else {
  console.warn("Redis disabled via REDIS_ENABLED=false");
}

function parseEnvList(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const schema = makeSchema({
  types: [
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
    schema: join(__dirname, "generated", "schema.graphql"),
    typegen: join(__dirname, "generated", "nexus-typegen.ts"),
  },
});

if (process.env.NODE_ENV === "development") {
  const typeMap = schema.getTypeMap();
  console.log("All GraphQL types:");
  Object.keys(typeMap).forEach((t) => console.log("  -", t));
}

async function startApolloServer() {
  if (isRedisEnabled) {
    await import("./workers/restock.worker.js");
  }

  const app = express();

  app.use(cookieParser());
  app.use(express.json());

  const server = new ApolloServer({
    schema,
  });

  await server.start();

  const configuredOrigins = parseEnvList(process.env.CORS_ORIGINS);
  const defaultOrigins = [
    "http://localhost:4000",
    "http://localhost:8081",
  ];
  const allowedOrigins = process.env.NODE_ENV === "production"
    ? [...new Set([process.env.FRONTEND_URL, ...configuredOrigins].filter(Boolean) as string[])]
    : [...new Set([...defaultOrigins, ...configuredOrigins])];

  app.use(
    "/graphql",
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    }),
    expressMiddleware(server, {
      context: async ({ req, res }) => {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];
        let user = null;

        if (token) {
          try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            if (decoded.userId) {
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
                },
              });

              if (user) {
                user.userId = user.id;
              }
            }
          } catch (error: any) {
            if (process.env.NODE_ENV === "development") {
              if (error.name === "TokenExpiredError") {
                console.warn("Access token expired");
              } else {
                console.error("JWT verification failed:", error.message);
              }
            }
          }
        }

        return {
          prisma,
          redisClient,
          user,
          req,
          res,
        };
      },
    }),
  );

  const PORT = Number(process.env.PORT) || 4000;
  const httpServer = http.createServer(app);

  initWebSocket(httpServer);

  httpServer.listen(PORT, "0.0.0.0", () => {
    if (process.env.NODE_ENV === "development") {
      console.log(`Server ready at http://localhost:${PORT}/graphql`);
      console.log("WebSocket server ready");
    }
  });
}

startApolloServer();
