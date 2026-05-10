import { extendType, nonNull, intArg, stringArg, list, arg, inputObjectType, objectType, nullable, enumType, } from "nexus";
import { requireAuth, requireRole, } from "../../../middleware/auth.middleware.js";
import * as transactionService from "../../../services/transaction.service.js";
export const CustomerDetails = inputObjectType({
    name: "CustomerDetailsInput",
    definition(t) {
        t.nullable.string("fullname");
        t.nullable.string("phoneNumber");
        t.nullable.string("email");
        t.nullable.field("paymentType", { type: "PaymentTypeEnum" });
        t.nullable.string("paymentMethodId");
        t.nullable.string("paymentIntentId");
        t.nullable.string("client_key");
        t.nullable.string("status");
        t.nullable.int("exp_month");
        t.nullable.int("exp_year");
        t.nullable.string("card_number");
        t.nullable.string("cvc");
        t.nullable.string("bank_code");
    },
});
export const CartItemInput = inputObjectType({
    name: "CartItemInput",
    definition(t) {
        t.nonNull.int("itemId"); // the ID of the item being sold
        t.nonNull.float("quantity"); // how many were sold
        t.nonNull.float("price"); // unit price
        t.nonNull.float("priceAtSale"); // ← add
        t.nullable.int("unitId"); // ← add
        t.nullable.string("unitName"); // ← add
        t.nullable.float("discountAmount"); // ← new — per-item discount amount
        t.nullable.float("discountQuantity"); // ← new — per-item discount quantity
        t.nullable.float("discountRate");
        t.nullable.field("discountType", { type: "DiscountType" });
        t.nullable.float("originalPrice");
        t.nullable.float("vatExclusivePrice");
        t.nullable.float("finalPrice");
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
                vatExemptSale: nullable(arg({ type: "Float" })),
                cashReceived: arg({ type: "Float" }),
                change: arg({ type: "Float" }),
                paymentMethod: nonNull(arg({ type: "PaymentMethod" })),
                paymentType: stringArg(),
                status: nonNull(arg({ type: "Status" })),
                createdAt: nonNull(stringArg()),
                discountType: nullable(arg({ type: "DiscountType" })),
                customerType: nullable(arg({ type: "CustomerType" })),
                scPwdCustomerInput: nullable(arg({ type: "ScPwdCustomerInput" })),
                discountRate: nullable(arg({ type: "Float" })),
                discountAmount: nullable(arg({ type: "Float" })),
                totalPax: nullable(intArg()),
                scPwdPax: nullable(intArg()),
                // ── VAT Exemption ────────────────────────────────────────────────────
                isVatExempt: nullable(arg({ type: "Boolean" })),
                vatExemptType: nullable(arg({ type: "VatExemptType" })),
                vatExemptRefNo: nullable(stringArg()),
                vatExemptAmount: nullable(arg({ type: "Float" })),
                // ── Promo ────────────────────────────────────────────────────────────
                outletPromoId: nullable(intArg()),
                promoDiscountAmt: nullable(arg({ type: "Float" })),
                itemsSold: nonNull(list(nonNull(arg({ type: "CartItemInput" })))),
            },
            async resolve(_, args, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);
                const { itemsSold, ...transactionData } = args;
                if (transactionData.scPwdPax && transactionData.totalPax && transactionData.scPwdPax > transactionData.totalPax) {
                    throw new Error("SC/PWD pax must be less than or equal to total pax.");
                }
                if (transactionData.customerType && transactionData.customerType !== "REGULAR") {
                    const customerInput = transactionData.scPwdCustomerInput;
                    if (!customerInput?.idNumber || !customerInput?.fullName) {
                        throw new Error("SC/PWD full name and ID number are required.");
                    }
                }
                if (!itemsSold || itemsSold.length === 0) {
                    throw new Error("Missing itemsSold array.");
                }
                try {
                    return await transactionService.processTransaction(transactionData, itemsSold);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error processing transaction:", error);
                    if (error.message.includes("Insufficient stock")) {
                        throw new Error(error.message);
                    }
                    throw new Error("Failed to process transaction.");
                }
            },
        });
        t.field("createScPwdCustomer", {
            type: "ScPwdCustomer",
            args: {
                data: nonNull(arg({ type: "ScPwdCustomerInput" })),
            },
            async resolve(_, { data }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);
                return ctx.prisma.scPwdCustomer.create({
                    data: {
                        orgId: ctx.user?.orgId ? Number(ctx.user.orgId) : undefined,
                        fullName: data.fullName,
                        idNumber: data.idNumber,
                        idType: data.idType,
                        customerType: data.customerType,
                        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
                        contactNumber: data.contactNumber ?? null,
                        address: data.address ?? null,
                        isRepresentative: data.isRepresentative ?? false,
                        representativeName: data.representativeName ?? null,
                        representativeIdNumber: data.representativeIdNumber ?? null,
                    },
                });
            },
        });
        t.field("updateScPwdCustomer", {
            type: "ScPwdCustomer",
            args: {
                id: nonNull(stringArg()),
                data: nonNull(arg({ type: "ScPwdCustomerInput" })),
            },
            async resolve(_, { id, data }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);
                return ctx.prisma.scPwdCustomer.update({
                    where: { id },
                    data: {
                        fullName: data.fullName,
                        idNumber: data.idNumber,
                        idType: data.idType,
                        customerType: data.customerType,
                        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
                        contactNumber: data.contactNumber ?? null,
                        address: data.address ?? null,
                        isRepresentative: data.isRepresentative ?? false,
                        representativeName: data.representativeName ?? null,
                        representativeIdNumber: data.representativeIdNumber ?? null,
                    },
                });
            },
        });
        t.field("initiatePayment", {
            type: "PaymentInitiation", // custom type with url field
            args: {
                outletId: nonNull(intArg()),
                total: nonNull(arg({ type: "Float" })),
                paymentMethod: nonNull(arg({ type: "PaymentMethod" })),
                paymentType: nonNull(arg({ type: "PaymentTypeEnum" })),
                customerDetails: nullable(arg({ type: "CustomerDetailsInput" })),
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
                    if (process.env.NODE_ENV === "development")
                        console.error(`Error upon making transaction through: ${error}`);
                    throw new Error("Error upon initiating transaction");
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
                customerDetails: nullable(arg({ type: "CustomerDetailsInput" })),
                itemsSold: nonNull(list(nonNull(arg({ type: CartItemInput })))),
            },
            resolve: async (_, args, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);
                const userId = ctx.user.userId;
                const { itemsSold, ...transactionData } = args;
                const fullTransactionData = {
                    transactionData,
                    createdAt: new Date().toISOString(),
                    cashierId: Number(userId),
                };
                try {
                    return await transactionService.finalizeTransaction(fullTransactionData, itemsSold);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error(`Error upon finalizing transaction: ${error}`);
                    throw new Error(`Error upon finalizing transaction: ${error.message || error}`);
                }
            },
        });
    },
});
