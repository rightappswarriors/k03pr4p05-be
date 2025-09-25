import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { makeSchema } from "nexus";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

// Import Node.js built-in modules for path resolution in ES modules
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Correct the import paths to match your file structure
import * as UserTypes from "./graphql/typeDefs/user.type.js";
import * as BranchTypes from "./graphql/typeDefs/branch.type.js";
import * as OutletTypes from "./graphql/typeDefs/outlet.type.js";
import * as OutletStaffTypes from "./graphql/typeDefs/outletStaff.type.js";
import * as InventoryTypes from "./graphql/typeDefs/inventory.type.js";
import * as InventoryItemsTypes from "./graphql/typeDefs/inventoryItems.type.js";
import * as LocationTypes from "./graphql/typeDefs/location.type.js";
import * as ItemTypes from "./graphql/typeDefs/item.type.js";
import * as CartItemTypes from "./graphql/typeDefs/cartItem.type.js";
import * as CategoryTypes from "./graphql/typeDefs/category.type.js";
import * as ColorTypes from "./graphql/typeDefs/color.type.js";
import * as TransactionTypes from "./graphql/typeDefs/transaction.type.js";
import { branchMutation } from "./graphql/resolvers/branch/branch.mutation.js";

import { branchQuery } from "./graphql/resolvers/branch/branch.query.js";
// User Mutation and Query
import * as UserMutations from "./graphql/resolvers/user/user.mutation.js";
import { userQuery } from "./graphql/resolvers/user/user.query.js";
// Outlet Resolvers
import * as OutletMutation from './graphql/resolvers/outlet/outlet.mutation.js'
import {OutletQuery} from './graphql/resolvers/outlet/outlet.query.js'
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "token";

// Initialize Prisma Client
const prisma = new PrismaClient();

// 2. Use `makeSchema` to stitch all your types and mutations together
const schema = makeSchema({
  types: [
    // Correctly unpack the individual types from the imported modules
    ...Object.values(UserTypes),
    userQuery,
    ...Object.values(TransactionTypes),
    ...Object.values(UserMutations),
    ...Object.values(OutletStaffTypes),
    ...Object.values(InventoryTypes),
    ...Object.values(InventoryItemsTypes),
    ...Object.values(LocationTypes),
    ...Object.values(ItemTypes),
    ...Object.values(CartItemTypes),
    ...Object.values(CategoryTypes),
    ...Object.values(ColorTypes),
    // Branches
    ...Object.values(BranchTypes),
    branchMutation,
    branchQuery,
    // Outlets
    ...Object.values(OutletTypes),
    ...Object.values(OutletMutation)

    // You will add other modules here as you create them, e.g.,
    // ...Object.values(BranchTypes),
    // ...Object.values(BranchMutations)
  ],
  outputs: {
    // This will generate `schema.graphql` and `nexus-typegen.ts`
    // Now using the correct path resolution for ES modules
    schema: join(__dirname, "generated", "schema.graphql"),
    typegen: join(__dirname, "generated", "nexus-typegen.ts"),
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
    "/graphql",
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];
        let user = null;
        if (token) {
          try {
            user = jwt.verify(token, JWT_SECRET);
          } catch (error) {
            console.error("JWT verification failed", error.message);
            throw new Error("Error verifying token", error);
          }
        }
        // Pass the Prisma Client to the context so it's available in your resolvers
        return {
          prisma,
          user,
        };
      },
    })
  );

  const PORT = 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
}

startApolloServer();
