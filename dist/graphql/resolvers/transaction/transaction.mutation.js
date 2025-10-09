import { extendType, nonNull, intArg, stringArg, list, arg, inputObjectType, objectType, nullable, enumType, } from "nexus";
import { requireAuth, requireRole, } from "../../../middleware/auth.middleware.js";
import * as transactionService from "../../../services/transaction.service.js";
export const CustomertDetails = inputObjectType({
    name: "CustomerDertails",
    definition(t) {
        t.nullable.string("fullname");
        t.nullable.string("phoneNumber");
        t.nullable.string("email");
        t.nullable.field("paymentType", { type: "PaymentType" });
        t.nullable.string("paymentMethodId");
        t.nullable.string("paymentIntentId");
        t.nullable.string("client_key");
        t.nullable.string("status");
    },
});
export const CartItemInput = inputObjectType({
    name: "CartItemInput",
    definition(t) {
        t.nonNull.int("itemId"); // the ID of the item being sold
        t.nonNull.int("quantity"); // how many were sold
        t.nonNull.float("price"); // unit price
    },
});
export const PaymentTypeEnum = enumType({
    name: "PaymentTypeEnum",
    members: ["gcash", "card", "paymaya", "qrph"],
});
export const PaymentInitiation = objectType({
    name: "PaymentInitiation",
    definition(t) {
        t.nonNull.string("url");
        t.nonNull.string("return_url");
        t.nonNull.string("public_key");
        t.nonNull.string("paymentIntentId");
        t.nonNull.string("client_key");
        t.nonNull.string("paymentMethodId");
    },
});
export const TransactionMutation = extendType({
    type: "Mutation",
    definition(t) {
        // Create a transaction
        t.field("createTransaction", {
            type: "Transaction",
            args: {
                outletId: nonNull(intArg()),
                cashierId: nonNull(intArg()),
                total: nonNull(arg({ type: "Float" })),
                subtotal: nonNull(arg({ type: "Float" })),
                vatAmount: nonNull(arg({ type: "Float" })),
                cashReceived: arg({ type: "Float" }),
                change: arg({ type: "Float" }),
                paymentMethod: nonNull(arg({ type: "PaymentMethod" })),
                paymentType: stringArg(),
                status: nonNull(arg({ type: "Status" })),
                createdAt: nonNull(stringArg()),
                itemsSold: nonNull(list(nonNull(arg({ type: CartItemInput })))),
            },
            async resolve(_, args, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);
                const { itemsSold, ...transactionData } = args;
                if (!itemsSold || itemsSold.length === 0) {
                    throw new Error("Missing itemsSold array.");
                }
                try {
                    return await transactionService.processTransaction(transactionData, itemsSold);
                }
                catch (error) {
                    console.error("Error processing transaction:", error);
                    if (error.message.includes("Insufficient stock")) {
                        throw new Error(error.message);
                    }
                    throw new Error("Failed to process transaction.");
                }
            },
        });
        t.field("initiatePayment", {
            type: "PaymentInitiation", // custom type with url field
            args: {
                outletId: nonNull(intArg()),
                total: nonNull(arg({ type: "Float" })),
                paymentMethod: nonNull(arg({ type: "PaymentMethod" })),
                customerDetails: nullable(arg({ type: "CustomerDertails" })),
            },
            resolve: async (_, transactionData, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);
                const userId = ctx.user.userId;
                const fullTransactionData = {
                    ...transactionData,
                    createdAt: new Date().toISOString(),
                    cashierId: Number(userId),
                };
                try {
                    return await transactionService.initiatePayment(fullTransactionData);
                }
                catch (error) {
                    console.error(`Error upon making transaction through ${transactionData.paymentType}`);
                    throw new Error(`Error upon making transaction through ${transactionData.paymentType}`);
                }
            },
        });
        t.field("finalizeTransaction", {
            type: "Transaction",
            args: {
                outletId: nonNull(intArg()),
                total: nonNull(arg({ type: "Float" })),
                subtotal: nonNull(arg({ type: "Float" })),
                vatAmount: nonNull(arg({ type: "Float" })),
                paymentMethod: nonNull(arg({ type: "PaymentMethod" })),
                paymentDetails: nonNull(arg({ type: "PaymentTypeEnum" })),
                createdAt: nonNull(stringArg()),
                itemsSold: nonNull(list(nonNull(arg({ type: CartItemInput })))),
            },
            resolve: async (_, args, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);
                const userId = ctx.user.userId;
                const { itemSold, ...transactionData } = args;
                const fullTransactionData = {
                    transactionData,
                    createdAt: new Date().toISOString(),
                    cashierId: Number(userId),
                };
                try {
                    return await transactionService.finalizeTransaction(fullTransactionData, itemSold);
                }
                catch (error) {
                    console.error(`Error upon making transaction through ${transactionData.paymentType}`);
                    throw new Error(`Error upon making transaction through ${transactionData.paymentType}`);
                }
            },
        });
    },
});
