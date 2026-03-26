import { objectType } from "nexus";
export const ItemCategory = objectType({
    name: "ItemCategory", // Renamed from Category
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.string("name");
        t.nullable.string("cost_of_sale");
        t.nullable.string("description");
        t.nullable.string("groupType");
        t.nullable.string("sales");
        t.nullable.string("stocks");
        t.nullable.int("groupId");
        t.nonNull.int("orgId"); // Added for multi-tenancy
        t.nonNull.field("org", {
            type: "Organization",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.itemCategory
                    .findUnique({ where: { id: parent.id } })
                    .org();
            },
        });
        t.nullable.field("group", {
            type: "ItemGroup",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.itemCategory
                    .findUnique({ where: { id: parent.id } })
                    .group();
            },
        });
        t.nonNull.list.nonNull.field("items", {
            type: "Item",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.itemCategory
                    .findUnique({ where: { id: parent.id } })
                    .items();
            },
        });
        t.field("_count", {
            type: objectType({
                name: "ItemCategoryCount",
                definition(ct) {
                    ct.int("itemCount");
                },
            }),
        });
    },
});
