import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import pkg from "@prisma/client"; // ← default import for CommonJS
import ws from "ws";
const { PrismaClient } = pkg; // ← destructure from default
neonConfig.webSocketConstructor = ws;
const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaNeon({ connectionString });
const prisma = global.prisma ??
    new PrismaClient({
        adapter,
    });
global.prisma = prisma;
export { prisma };
