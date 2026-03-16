import { objectType, extendType, inputObjectType, nonNull, intArg, list, arg, enumType } from "nexus";
export const MediaTypeEnum = enumType({
    name: "MediaType",
    members: ["image", "video"],
});
export const MediaType = objectType({
    name: "Media",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.string("url");
        t.nullable.field("type", { type: "MediaType" });
        t.nonNull.int("sortOrder"); // 0 = primary/hero, 1, 2, 3...
        t.nullable.int("itemId");
    },
});
// Input for reordering — an array of { id, sortOrder } pairs
export const MediaSortOrderInput = inputObjectType({
    name: "MediaSortOrderInput",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.int("sortOrder");
    },
});
export const AddMediaInput = inputObjectType({
    name: "AddMediaInput",
    definition(t) {
        t.nonNull.string("url");
        t.nullable.field("type", { type: "MediaType" });
        t.nonNull.int("sortOrder");
    },
});
// ─── Queries ──────────────────────────────────────────────────────────────────
export const MediaQuery = extendType({
    type: "Query",
    definition(t) {
        // Get all media for an item, ordered by sortOrder ascending
        t.nonNull.list.nonNull.field("itemMedia", {
            type: "Media",
            args: { itemId: nonNull(intArg()) },
            resolve: (_root, { itemId }, ctx) => ctx.prisma.media.findMany({
                where: { itemId },
                orderBy: { sortOrder: "asc" }, // sortOrder 0 = primary image first
            }),
        });
    },
});
// ─── Mutations ────────────────────────────────────────────────────────────────
export const MediaMutation = extendType({
    type: "Mutation",
    definition(t) {
        // Add media to an item
        t.nonNull.list.nonNull.field("addItemMedia", {
            type: "Media",
            args: {
                itemId: nonNull(intArg()),
                media: nonNull(list(nonNull(arg({ type: "AddMediaInput" })))),
            },
            resolve: async (_root, { itemId, media }, ctx) => {
                // If any new media has sortOrder 0, bump existing sortOrder 0 items up
                const hasNewPrimary = media.some((m) => m.sortOrder === 0);
                if (hasNewPrimary) {
                    await ctx.prisma.media.updateMany({
                        where: { itemId, sortOrder: 0 },
                        data: { sortOrder: 999 }, // temp value, will be overwritten below
                    });
                }
                return ctx.prisma.$transaction(media.map((m) => ctx.prisma.media.create({
                    data: { url: m.url, type: m.type ?? null, sortOrder: m.sortOrder, itemId },
                })));
            },
        });
        // Reorder media — pass the full new order as [{ id, sortOrder }]
        // e.g. user drags photo 3 to position 0 → send updated array
        t.nonNull.list.nonNull.field("reorderItemMedia", {
            type: "Media",
            args: {
                itemId: nonNull(intArg()),
                order: nonNull(list(nonNull(arg({ type: "MediaSortOrderInput" })))),
            },
            resolve: async (_root, { itemId, order }, ctx) => {
                // Validate all IDs belong to this item
                const existing = await ctx.prisma.media.findMany({
                    where: { itemId },
                    select: { id: true },
                });
                const existingIds = new Set(existing.map((m) => m.id));
                for (const o of order) {
                    if (!existingIds.has(o.id)) {
                        throw new Error(`Media ${o.id} does not belong to item ${itemId}`);
                    }
                }
                // Update all sortOrders atomically
                await ctx.prisma.$transaction(order.map((o) => ctx.prisma.media.update({
                    where: { id: o.id },
                    data: { sortOrder: o.sortOrder },
                })));
                // Return updated list in new order
                return ctx.prisma.media.findMany({
                    where: { itemId },
                    orderBy: { sortOrder: "asc" },
                });
            },
        });
        // Set a single media as primary (sortOrder = 0, shifts all others up)
        t.nonNull.list.nonNull.field("setItemPrimaryMedia", {
            type: "Media",
            args: {
                itemId: nonNull(intArg()),
                mediaId: nonNull(intArg()),
            },
            resolve: async (_root, { itemId, mediaId }, ctx) => {
                const allMedia = await ctx.prisma.media.findMany({
                    where: { itemId },
                    orderBy: { sortOrder: "asc" },
                });
                if (!allMedia.find((m) => m.id === mediaId)) {
                    throw new Error(`Media ${mediaId} does not belong to item ${itemId}`);
                }
                // Reassign sortOrder: target = 0, rest in their existing relative order
                const others = allMedia.filter((m) => m.id !== mediaId);
                const newOrder = [
                    { id: mediaId, sortOrder: 0 },
                    ...others.map((m, idx) => ({ id: m.id, sortOrder: idx + 1 })),
                ];
                await ctx.prisma.$transaction(newOrder.map((o) => ctx.prisma.media.update({
                    where: { id: o.id },
                    data: { sortOrder: o.sortOrder },
                })));
                return ctx.prisma.media.findMany({
                    where: { itemId },
                    orderBy: { sortOrder: "asc" },
                });
            },
        });
        // Delete a media item (and compact remaining sortOrders)
        t.nonNull.field("deleteItemMedia", {
            type: "Media",
            args: { id: nonNull(intArg()) },
            resolve: async (_root, { id }, ctx) => {
                const deleted = await ctx.prisma.media.delete({ where: { id } });
                // Compact remaining sortOrders so there are no gaps
                if (deleted.itemId) {
                    const remaining = await ctx.prisma.media.findMany({
                        where: { itemId: deleted.itemId },
                        orderBy: { sortOrder: "asc" },
                    });
                    await ctx.prisma.$transaction(remaining.map((m, idx) => ctx.prisma.media.update({
                        where: { id: m.id },
                        data: { sortOrder: idx },
                    })));
                }
                return deleted;
            },
        });
    },
});
// ─────────────────────────────────────────────────────────────────────────────
// 3. HOW sortOrder WORKS
// ─────────────────────────────────────────────────────────────────────────────
/*
sortOrder = 0  → primary/hero image (shown first in Ekumpra listing card)
sortOrder = 1  → second image
sortOrder = 2  → third image
...and so on
 
When fetching items for Ekumpra, always do:
  include: {
    media: { orderBy: { sortOrder: 'asc' }, take: 1 }  // just the hero image
  }
 
For the full gallery:
  include: {
    media: { orderBy: { sortOrder: 'asc' } }           // all images in order
  }
 
The three mutations give you:
  reorderItemMedia  → drag-and-drop reorder (pass full new order array)
  setItemPrimaryMedia → tap a photo to make it the cover/hero
  deleteItemMedia   → remove a photo and auto-compact the remaining order
*/
