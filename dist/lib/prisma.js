/**import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import pkg from "@prisma/client"; // ← default import for CommonJS
import ws from "ws";
const { PrismaClient } = pkg; // ← destructure from default
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });

const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
  });

global.prisma = prisma;

export { prisma };
**/
import { PrismaClient } from "@prisma/client";
import { softDeleteExtension } from "./softDelete.js";
const createPrismaClient = () => new PrismaClient().$extends(softDeleteExtension());
const globalForPrisma = global;
export const prisma = globalForPrisma.prisma ??
    createPrismaClient();
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
