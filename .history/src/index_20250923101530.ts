import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { makeSchema } from 'nexus';
import { PrismaClient } from '@prisma/client';


// Import Node.js built-in modules for path resolution in ES modules
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

// 1. Import all your Nexus types and mutations
import * as UserTypes from './graphql/typeDefs/user.type.js';
import * as UserMutations from './graphql/resolvers/user/user.mutation.js';

import cors from "cors";
// 2. Use `makeSchema` to stitch all your types and mutations together
const schema = makeSchema({
  types: [
    UserTypes,
    UserMutations
    // You will add other modules here as you create them, e.g.,
    // BranchTypes,
    // BranchMutations
  ],
  outputs: {
    // This will generate `schema.graphql` and `nexus-typegen.ts`
    // These files are essential for type safety and client tooling
    schema: __dirname + '/generated/schema.graphql',
    typegen: __dirname + '/generated/nexus-typegen.ts',
  },
});

// 1. Define schema
// 2. Define resolvers

// 3. Initialize Apollo server
async function startApolloServer() {
  const app = express();

  const server = new ApolloServer({
    schema
  });

  await server.start();

  // 👇 use express.json() instead of body-parser.json()
  app.use("/graphql", cors(), express.json(), expressMiddleware(server, {
    context: async ({ req }) => {
      const token = req.headers.authorization || "";
      return { token };
    },
  }));

  const PORT = 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
}

startApolloServer();
