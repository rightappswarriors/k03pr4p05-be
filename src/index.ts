import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { makeSchema } from "nexus";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
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
import * as TokenMutation from "./graphql/resolvers/token/token.mutation.js";
import * as APITypes from "./graphql/typeDefs/paymogoAPI.type.js";
import * as PaymentDetails from "./graphql/typeDefs/paymentDetails.type.js";
import * as BrandTypes from "./graphql/typeDefs/brand.type.js"
// Branch Mutation and QUery
import { branchMutation } from "./graphql/resolvers/branch/branch.mutation.js";
import { branchQuery } from "./graphql/resolvers/branch/branch.query.js";
// User Mutation and Query
import * as UserMutations from "./graphql/resolvers/user/user.mutation.js";
import * as UserQuery from "./graphql/resolvers/user/user.query.js";
// Outlet Resolvers
import * as OutletMutation from "./graphql/resolvers/outlet/outlet.mutation.js";
import * as OutletQuery from "./graphql/resolvers/outlet/outlet.query.js";
// Inventroy Resolvers
import * as InventoryMutation from "./graphql/resolvers/inventory/inventory.mutation.js";
import * as InventoryQuery from "./graphql/resolvers/inventory/inventory.query.js";
// Category Resolvers
import * as CategoryMutation from "./graphql/resolvers/category/category.mutation.js";
import * as CategoryQuery from "./graphql/resolvers/category/category.query.js";
// Item Resolvers
import * as ItemMutation from "./graphql/resolvers/item/item.mutation.js";
import * as ItemQuery from "./graphql/resolvers/item/item.query.js";
// Trasaction Resolvers
import * as TransactionQuery from "./graphql/resolvers/transaction/transaction.query.js";
import * as TransactionMutation from "./graphql/resolvers/transaction/transaction.mutation.js";
// API keys
import * as APIQuery from "./graphql/resolvers/userAPIKey/userAPI.query.js";
import * as APIMutation from "./graphql/resolvers/userAPIKey/userAPI.mutation.js";
import { prisma } from "./lib/prisma.js"
import jwt from "jsonwebtoken";
/*
// Mode of Payment
import * as ModeOfPaymentType from "./graphql/typeDefs/modeOfpayment.type.js";
import * as ModeOfPaymentMutation from "./graphql/resolvers/modeOfPayment/payment.mutation.js";
import * as ModeOfPaymentQuery from "./graphql/resolvers/modeOfPayment/payment.query.js";
// Supplier
import * as Supplier from "./graphql/typeDefs/supplier.type.js";
import * as SupplierMutation from "./graphql/resolvers/supplier/supplier.mutation.js";
import * as SupplierQuery from "./graphql/resolvers/supplier/supplier.query.js";*/
// Enums
import * as Enums from "./graphql/typeDefs/enum.js";
const JWT_SECRET = process.env.JWT_SECRET || "token";
import { DateTimeScalar } from './lib/scalars.js'
// OutletPromo
import * as OutletPromo from "./graphql/typeDefs/outletPromo.type.js"
import http from "http"
import { initWebSocket } from "./lib/ws.js"
// PromoType 
import * as PromoType from "./graphql/typeDefs/promo.type.js"
import * as MediaType from "./graphql/typeDefs/media.type.js"
import * as InventoryItems from "./graphql/typeDefs/inventoryItemUnit.type.js"
// Initialize Prisma Client


// 2. Use `makeSchema` to stitch all your types and mutations together
const schema = makeSchema({
  types: [
    // Correctly unpack the individual types from the imported modules
    DateTimeScalar,
    ...Object.values(TransactionTypes),
    ...Object.values(OutletStaffTypes),
    ...Object.values(InventoryTypes),
    ...Object.values(InventoryItemsTypes),
    ...Object.values(LocationTypes),
    ...Object.values(ItemTypes),
    ...Object.values(CartItemTypes),
    ...Object.values(CategoryTypes),
    ...Object.values(ColorTypes),
    // User
    ...Object.values(UserMutations),
    ...Object.values(UserQuery),
    ...Object.values(UserTypes),

    // Branches Types and Resolvers
    ...Object.values(BranchTypes),
    branchMutation,
    branchQuery,

    // Category
    ...Object.values(CategoryMutation),
    ...Object.values(CategoryQuery),

    // Outlets Types and Resolvers
    ...Object.values(OutletTypes),
    ...Object.values(OutletMutation),
    ...Object.values(OutletQuery),
    // Inventory
    ...Object.values(InventoryQuery),
    ...Object.values(InventoryMutation),

    // Item
    ...Object.values(ItemQuery),
    ...Object.values(ItemMutation),

    // Transaction
    ...Object.values(TransactionMutation),
    ...Object.values(TransactionQuery),
    // Payment
    ...Object.values(PaymentDetails),
    // Token
    ...Object.values(TokenMutation),
    // You will add other modules here as you create them, e.g.,
    // ...Object.values(BranchTypes),
    // ...Object.values(BranchMutations)
    // APi
    ...Object.values(APIMutation),
    ...Object.values(APIQuery),
    ...Object.values(APITypes),
    //* Mode of Payment
    //...Object.values(ModeOfPaymentType),
    //...Object.values(ModeOfPaymentQuery),
    //...Object.values(ModeOfPaymentMutation),
    // Supplier
    //...Object.values(Supplier),
    //...Object.values(SupplierMutation),
    //...Object.values(SupplierQuery),
    // Enum
    ...Object.values(Enums),
    // OutletPromo
    ...Object.values(OutletPromo),
    // PromoType
    ...Object.values(PromoType),
    ...Object.values(MediaType),
    // Brand 
    ...Object.values(BrandTypes),
    ...Object.values(InventoryItems)
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

  app.use(cookieParser());
  app.use(express.json());
  const server = new ApolloServer({
    schema,
  });

  await server.start();
  const allowedOrigins = [
    // frontend URLS
    // POS Add here
    // Management
    "http://localhost:4000", // Testing (but NOT /graphql, only the base URL!)
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
      credentials: true, // allow cookies to be sent
    }),
    expressMiddleware(server, {
      context: async ({ req, res }) => {
        const authHeader = req.headers["authorization"];
        //console.log("Auth Header:", authHeader);
        const token = authHeader?.split(" ")[1];
        let user = null;
        if (token) {
          try {
            user = jwt.verify(token, JWT_SECRET);
          } catch (error) {
            if (process.env.NODE_ENV === "development") {
              if (error.name === "TokenExpiredError") {
                console.warn("Access token expired");
              } else {
                console.error("JWT verification failed:", error.message);
              }
            }
          }
        }
        // Pass the Prisma Client to the context so it's available in your resolvers
        return {
          prisma,
          user,
          req,
          res,
        };
      },
    })
  );

  const PORT = process.env.PORT || 4000;
  const httpServer = http.createServer(app)
  // initialize websocket
  initWebSocket(httpServer)

  httpServer.listen(PORT, () => {
    if (process.env.NODE_ENV === "development") {
      console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
      console.log(`🔌 WebSocket server ready`)
    }
  })
}

startApolloServer();
