import { enumType, inputObjectType, objectType } from "nexus";
export const DiscountTypeEnum = enumType({
    name: "DiscountType",
    members: [
        "NONE",
        "SENIOR_CITIZEN",
        "PWD",
        "BNPC_SENIOR_CITIZEN",
        "BNPC_PWD",
        "CUSTOM",
    ],
});
export const CustomerTypeEnum = enumType({
    name: "CustomerType",
    members: ["REGULAR", "SENIOR_CITIZEN", "PWD"],
});
export const ScPwdCustomerType = objectType({
    name: "ScPwdCustomer",
    definition(t) {
        t.nonNull.string("id");
        t.nullable.int("orgId");
        t.nonNull.string("fullName");
        t.nonNull.string("idNumber");
        t.nullable.string("oscaId");
        t.nullable.string("govId");
        t.nonNull.string("idType");
        t.nonNull.field("customerType", { type: "CustomerType" });
        t.nullable.dateTime("dateOfBirth");
        t.nullable.string("contactNumber");
        t.nullable.string("address");
        t.nonNull.boolean("bnpcCapManuallyReached");
        t.nullable.string("bnpcCapManualReason");
        t.nonNull.boolean("isRepresentative");
        t.nullable.string("representativeName");
        t.nullable.string("representativeIdNumber");
        t.nonNull.dateTime("createdAt");
        t.nonNull.dateTime("updatedAt");
    },
});
export const ScPwdCustomerInput = inputObjectType({
    name: "ScPwdCustomerInput",
    definition(t) {
        t.nullable.string("id");
        t.nonNull.string("fullName");
        t.nonNull.string("idNumber");
        t.nullable.string("oscaId");
        t.nullable.string("govId");
        t.nonNull.string("idType");
        t.nonNull.field("customerType", { type: "CustomerType" });
        t.nullable.string("dateOfBirth");
        t.nullable.string("contactNumber");
        t.nullable.string("address");
        t.nullable.boolean("bnpcCapManuallyReached");
        t.nullable.string("bnpcCapManualReason");
        t.nullable.boolean("isRepresentative");
        t.nullable.string("representativeName");
        t.nullable.string("representativeIdNumber");
    },
});
export const BirDiscountLogbookEntry = objectType({
    name: "BirDiscountLogbookEntry",
    definition(t) {
        t.nonNull.dateTime("date");
        t.nonNull.string("orNumber");
        t.nonNull.string("fullName");
        t.nonNull.string("idNumber");
        t.nonNull.string("itemsPurchased");
        t.nonNull.float("totalBeforeDiscount");
        t.nonNull.float("discountAmount");
        t.nonNull.float("netAmountPaid");
        t.nonNull.field("discountType", { type: "DiscountType" });
    },
});
