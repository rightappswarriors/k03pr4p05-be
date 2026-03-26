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
import * as ItemCategoryTypes from "./graphql/typeDefs/itemCategory.type.js"; // Updated from CategoryTypes
import * as ColorTypes from "./graphql/typeDefs/color.type.js";
import * as TransactionTypes from "./graphql/typeDefs/transaction.type.js";
import * as TokenMutation from "./graphql/resolvers/token/token.mutation.js";
import * as APITypes from "./graphql/typeDefs/paymogoAPI.type.js";
import * as PaymentDetails from "./graphql/typeDefs/paymentDetails.type.js";
import * as BrandTypes from "./graphql/typeDefs/brand.type.js";
// New type imports for multi-tenancy and ERP
import * as OrganizationTypes from "./graphql/typeDefs/organization.type.js";
import * as SubscriptionTypes from "./graphql/typeDefs/subscription.type.js";
import * as VatTypeTypes from "./graphql/typeDefs/vatType.type.js";
import * as DepartmentTypes from "./graphql/typeDefs/department.type.js";
import * as PositionTypes from "./graphql/typeDefs/position.type.js";
import * as CenterTypes from "./graphql/typeDefs/center.type.js";
import * as SubCenterTypes from "./graphql/typeDefs/subCenter.type.js";
import * as AccountTitleTypes from "./graphql/typeDefs/accountTitle.type.js";
import * as EmployeeTypes from "./graphql/typeDefs/employee.type.js";
import * as GISRowTypes from "./graphql/typeDefs/gisRow.type.js";
import * as SummaryRowTypes from "./graphql/typeDefs/summaryRow.type.js";
import * as SalesOrderTypes from "./graphql/typeDefs/salesOrder.type.js";
import * as InventoryItemTypes from "./graphql/typeDefs/inventoryItem.type.js";
import * as ItemGroupTypes from "./graphql/typeDefs/itemGroup.type.js";
import * as PlaceLocationTypes from "./graphql/typeDefs/placeLocation.type.js";
import * as EkumpraTypes from "./graphql/typeDefs/ekumpra.type.js";
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
import * as ItemCategoryMutation from "./graphql/resolvers/category/category.mutation.js"; // Updated to itemCategory
import * as ItemCategoryQuery from "./graphql/resolvers/category/category.query.js"; // Updated to itemCategory
// Item Resolvers
import * as ItemMutation from "./graphql/resolvers/item/item.mutation.js";
import * as ItemQuery from "./graphql/resolvers/item/item.query.js";
// Trasaction Resolvers
import * as TransactionQuery from "./graphql/resolvers/transaction/transaction.query.js";
import * as TransactionMutation from "./graphql/resolvers/transaction/transaction.mutation.js";
// API keys
import * as APIQuery from "./graphql/resolvers/userAPIKey/userAPI.query.js";
import * as APIMutation from "./graphql/resolvers/userAPIKey/userAPI.mutation.js";
// New resolver imports for multi-tenancy and ERP
import * as OrganizationQuery from "./graphql/resolvers/organization/organization.query.js";
import * as OrganizationMutation from "./graphql/resolvers/organization/organization.mutation.js";
import * as SubscriptionQuery from "./graphql/resolvers/subscription/subscription.query.js";
import * as SubscriptionMutation from "./graphql/resolvers/subscription/subscription.mutation.js";
import * as VatTypeQuery from "./graphql/resolvers/vatType/vatType.query.js";
import * as VatTypeMutation from "./graphql/resolvers/vatType/vatType.mutation.js";
import * as DepartmentQuery from "./graphql/resolvers/department/department.query.js";
import * as DepartmentMutation from "./graphql/resolvers/department/department.mutation.js";
import * as PositionQuery from "./graphql/resolvers/position/position.query.js";
import * as PositionMutation from "./graphql/resolvers/position/position.mutation.js";
import * as CenterQuery from "./graphql/resolvers/center/center.query.js";
import * as CenterMutation from "./graphql/resolvers/center/center.mutation.js";
import * as SubCenterQuery from "./graphql/resolvers/subCenter/subCenter.query.js";
import * as SubCenterMutation from "./graphql/resolvers/subCenter/subCenter.mutation.js";
import * as AccountTitleQuery from "./graphql/resolvers/accountTitle/accountTitle.query.js";
import * as AccountTitleMutation from "./graphql/resolvers/accountTitle/accountTitle.mutation.js";
import * as EmployeeQuery from "./graphql/resolvers/employee/employee.query.js";
import * as EmployeeMutation from "./graphql/resolvers/employee/employee.mutation.js";
import * as GISRowQuery from "./graphql/resolvers/gisRow/gisRow.query.js";
import * as GISRowMutation from "./graphql/resolvers/gisRow/gisRow.mutation.js";
import * as SummaryRowQuery from "./graphql/resolvers/summaryRow/summaryRow.query.js";
import * as SummaryRowMutation from "./graphql/resolvers/summaryRow/summaryRow.mutation.js";
import * as SalesOrderQuery from "./graphql/resolvers/salesOrder/salesOrder.query.js";
import * as SalesOrderMutation from "./graphql/resolvers/salesOrder/salesOrder.mutation.js";
import * as InventoryItemQuery from "./graphql/resolvers/inventoryItem/inventoryItem.query.js";
import * as InventoryItemMutation from "./graphql/resolvers/inventoryItem/inventoryItem.mutation.js";
import * as ItemGroupQuery from "./graphql/resolvers/itemGroup/itemGroup.query.js";
import * as ItemGroupMutation from "./graphql/resolvers/itemGroup/itemGroup.mutation.js";
import * as PlaceLocationQuery from "./graphql/resolvers/placeLocation/placeLocation.query.js";
import * as PlaceLocationMutation from "./graphql/resolvers/placeLocation/placeLocation.mutation.js";
import { prisma } from "./lib/prisma.js";
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
import { DateTimeScalar, JsonScalar } from './lib/scalars.js';
// OutletPromo
import * as OutletPromo from "./graphql/typeDefs/outletPromo.type.js";
import http from "http";
import { initWebSocket } from "./lib/ws.js";
// PromoType 
import * as PromoType from "./graphql/typeDefs/promo.type.js";
import * as MediaType from "./graphql/typeDefs/media.type.js";
import * as InventoryItems from "./graphql/typeDefs/inventoryItemUnit.type.js";
// Initialize Prisma Client
const schema = makeSchema({
    types: [
        // Correctly unpack the individual types from the imported modules
        DateTimeScalar,
        JsonScalar,
        ...Object.values(TransactionTypes),
        ...Object.values(OutletStaffTypes),
        ...Object.values(InventoryTypes),
        ...Object.values(InventoryItemsTypes),
        ...Object.values(LocationTypes),
        ...Object.values(ItemTypes),
        ...Object.values(CartItemTypes),
        ...Object.values(ItemCategoryTypes), // Updated from CategoryTypes
        ...Object.values(ColorTypes),
        // New types for multi-tenancy and ERP
        ...Object.values(OrganizationTypes),
        ...Object.values(SubscriptionTypes),
        ...Object.values(VatTypeTypes),
        ...Object.values(DepartmentTypes),
        ...Object.values(PositionTypes),
        ...Object.values(CenterTypes),
        ...Object.values(SubCenterTypes),
        ...Object.values(AccountTitleTypes),
        ...Object.values(EmployeeTypes),
        ...Object.values(GISRowTypes),
        ...Object.values(SummaryRowTypes),
        ...Object.values(SalesOrderTypes),
        ...Object.values(InventoryItemTypes),
        ...Object.values(ItemGroupTypes),
        ...Object.values(PlaceLocationTypes),
        ...Object.values(EkumpraTypes),
        // User
        ...Object.values(UserMutations),
        ...Object.values(UserQuery),
        ...Object.values(UserTypes),
        // Branches Types and Resolvers
        ...Object.values(BranchTypes),
        branchMutation,
        branchQuery,
        // Category
        ...Object.values(ItemCategoryMutation), // Updated from CategoryMutation
        ...Object.values(ItemCategoryQuery), // Updated from CategoryQuery
        // New resolvers for multi-tenancy and ERP
        ...Object.values(OrganizationQuery),
        ...Object.values(OrganizationMutation),
        ...Object.values(SubscriptionQuery),
        ...Object.values(SubscriptionMutation),
        ...Object.values(VatTypeQuery),
        ...Object.values(VatTypeMutation),
        ...Object.values(DepartmentQuery),
        ...Object.values(DepartmentMutation),
        ...Object.values(PositionQuery),
        ...Object.values(PositionMutation),
        ...Object.values(CenterQuery),
        ...Object.values(CenterMutation),
        ...Object.values(SubCenterQuery),
        ...Object.values(SubCenterMutation),
        ...Object.values(AccountTitleQuery),
        ...Object.values(AccountTitleMutation),
        ...Object.values(EmployeeQuery),
        ...Object.values(EmployeeMutation),
        ...Object.values(GISRowQuery),
        ...Object.values(GISRowMutation),
        ...Object.values(SummaryRowQuery),
        ...Object.values(SummaryRowMutation),
        ...Object.values(SalesOrderQuery),
        ...Object.values(SalesOrderMutation),
        ...Object.values(InventoryItemQuery),
        ...Object.values(InventoryItemMutation),
        ...Object.values(ItemGroupQuery),
        ...Object.values(ItemGroupMutation),
        ...Object.values(PlaceLocationQuery),
        ...Object.values(PlaceLocationMutation),
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
    const allowedOrigins = [
        "http://localhost:4000",
        "http://192.168.254.104:8081",
        "exp://192.168.254.104:8081",
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
        //origin: true,
        credentials: true, // allow cookies to be sent
    }), expressMiddleware(server, {
        context: async ({ req, res }) => {
            const authHeader = req.headers["authorization"];
            //console.log("Auth Header:", authHeader);
            const token = authHeader?.split(" ")[1];
            let user = null;
            if (token) {
                try {
                    user = jwt.verify(token, JWT_SECRET);
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
