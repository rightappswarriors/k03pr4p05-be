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
import { createClient } from "redis";

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { prisma } from "./lib/prisma.js"
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "token";
import { DateTimeScalar, JsonScalar } from './lib/scalars.js'
// import { ValueNode, Kind } from "graphql";

// OutletPromo
// import * as OutletPromo from "./graphql/typeDefs/outletPromo.type.js"
import http from "http"
import { initWebSocket } from "./lib/ws.js"
import { resolvePermissionState } from "./lib/permissionResolution.js"
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
    ? [process.env.FRONTEND_URL!]
    : [
      "http://localhost:4000",

      "http://localhost:8081",
      "exp+pos-vine-mman://expo-development-client/?url=https%3A%2F%2Fcb04bpw-nuelgrace-8081.exp.direct",
      "http://192.168.254.254:8081",
      "exp://192.168.254.254:8081",
      "http://192.168.254.125:4000",
      "exp://192.168.254.125:8081",
    ];

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
        let user = null;
        let userPermissions: Record<string, {
          canView: boolean;
          canCreate: boolean;
          canEdit: boolean;
          canDelete: boolean;
        }> = {};
        let controlPermissions: Record<string, boolean> = {};

        const token = req.headers["authorization"]?.split(" ")[1];

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
                  approvalStatus: true,
                  isVerified: true,
                  fullname: true,
                  username: true,
                  isOwner: true,
                  org: { select: { accountStatus: true, roles: true } },
                  position: {
                    select: {
                      id: true,
                      name: true,
                      orgId: true,
                      // PositionPermission[] → Page
                      permissions: {
                        select: {
                          canView: true,
                          canCreate: true,
                          canEdit: true,
                          canDelete: true,
                          page: {
                            select: {
                              key: true,   // ← this is what you index by
                              label: true,
                              access: true,
                              parentKey: true,
                            }
                          }
                        }
                      },
                      controlPermissions: {
                        select: { controlKey: true, isAllowed: true }
                      },
                    }
                  },
                  permissionOverrides: {
                    select: {
                      canView: true,
                      canCreate: true,
                      canEdit: true,
                      canDelete: true,
                      page: { select: { key: true } },
                    }
                  },
                }
              });

              if (user) {
                user.userId = user.id;
                user.orgAccountStatus = user.org?.accountStatus ?? null;
                user.orgRoles = user.org?.roles ?? [];

                // Build lookup map — only for non-owners
                // Owners bypass permission checks entirely
                const privileged = user.isOwner || user.role === 'OWNER' || user.role === 'MANAGER' || user.role === 'ADMIN';
                if (!privileged) {
                  const resolved = resolvePermissionState({
                    userOrgId: user.orgId,
                    positionOrgId: user.position?.orgId,
                    positionPermissions: user.position?.permissions,
                    overrides: user.permissionOverrides,
                    controlPermissions: user.position?.controlPermissions,
                  });
                  userPermissions = resolved.userPermissions;
                  controlPermissions = resolved.controlPermissions;
                }
              }
            }
          } catch (error: any) {
            if (error.name === "TokenExpiredError") {
              console.warn("Access token expired");
            } else if (process.env.NODE_ENV === "development") {
              console.error("JWT error:", error.message);
            }
          }
        }

        return { prisma, redisClient, user, userPermissions, controlPermissions, req, res };
      }
    })
  );

  const PORT = Number(process.env.PORT) || 4000;
  const httpServer = http.createServer(app)
  // initialize websocket
  initWebSocket(httpServer)

  httpServer.listen(PORT, "0.0.0.0", () => {
    if (process.env.NODE_ENV === "development") {
      console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
      console.log(`🔌 WebSocket server ready`)
    }
  })
}

startApolloServer();
