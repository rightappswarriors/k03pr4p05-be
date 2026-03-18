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

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}