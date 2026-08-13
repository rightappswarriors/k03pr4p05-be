import { objectType } from "nexus";
// NEW - Global base category (super admin)
export const ItemCategory = objectType({
    name: "ItemCategory",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.string("name");
        t.nullable.string("description");
        t.nullable.string("icon");
        t.nullable.string("groupType");
        t.nullable.dateTime("createdAt");
        t.nonNull.list.nonNull.field("orgCategories", {
            type: "OrgItemCategory",
            resolve: (parent, _, ctx) => ctx.prisma.itemCategory
                .findUnique({ where: { id: parent.id } })
                .orgCategories(),
        });
    },
});
// NEW - Org's customized category
export const OrgItemCategory = objectType({
    name: "OrgItemCategory",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.int("orgId");
        t.nullable.int("categoryId");
        t.nullable.string("name"); // org override
        t.nullable.string("description"); // org override
        t.nullable.string("icon"); // org override
        t.nullable.string("cost_of_sale");
        t.nullable.string("groupType");
        t.nullable.string("sales");
        t.nullable.string("stocks");
        t.nullable.int("groupId");
        t.nonNull.boolean("isActive");
        t.nonNull.dateTime("createdAt");
        t.nullable.field("globalCategory", {
            type: "ItemCategory",
            resolve: (parent, _, ctx) => {
                if (!parent.categoryId)
                    return null; // ✅ guard
                return ctx.prisma.orgItemCategory
                    .findUnique({ where: { id: parent.id } })
                    .globalCategory();
            },
        });
        t.nullable.field("group", {
            type: "ItemGroup",
            resolve: (parent, _, ctx) => ctx.prisma.orgItemCategory
                .findUnique({ where: { id: parent.id } })
                .group(),
        });
        t.nonNull.field("org", {
            type: "Organization",
            resolve: (parent, _, ctx) => ctx.prisma.orgItemCategory
                .findUnique({ where: { id: parent.id } })
                .org(),
        });
        t.nonNull.list.nonNull.field("items", {
            type: "Item",
            resolve: (parent, _, ctx) => ctx.prisma.orgItemCategory
                .findUnique({ where: { id: parent.id } })
                .items(),
        });
    },
});
