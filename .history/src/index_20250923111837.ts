import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { makeSchema } from 'nexus';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// Import Node.js built-in modules for path resolution in ES modules
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Correct the import paths to match your file structure
import { User, Role } from './graphql/typeDefs/user.type.js';
import { Branch } from './graphql/typeDefs/branch.type.js';

import { Outlet, OutletType } from './graphql/typeDefs/outlet.type.js';

import { userMutation } from './graphql/resolvers/user/user.mutation.js';

// Initialize Prisma Client
const prisma = new PrismaClient();

// 2. Use `makeSchema` to stitch all your types and mutations together
const schema = makeSchema({
  types: [
    // Correctly unpack the individual types from the imported modules
    User, Role, userMutation, Outlet, OutletType, Branch
    // You will add other modules here as you create them, e.g.,
    // ...Object.values(BranchTypes),
    // ...Object.values(BranchMutations)
  ],
  outputs: {
    // This will generate `schema.graphql` and `nexus-typegen.ts`
    // Now using the correct path resolution for ES modules
    schema: join(__dirname, 'generated', 'schema.graphql'),
    typegen: join(__dirname, 'generated', 'nexus-typegen.ts'),
  },
});

// 3. Initialize Apollo server with the generated schema
async function startApolloServer() {
  const app = express();

  const server = new ApolloServer({
    schema,
  });

  await server.start();

  app.use(
    '/graphql',
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: async () => ({
        // Pass the Prisma Client to the context so it's available in your resolvers
        prisma,
      }),
    }),
  );

  const PORT = 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
}

startApolloServer();
