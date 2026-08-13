// lib/ekumpra/nearestOutletSearch.ts
// ─────────────────────────────────────────────────────────────────────────────
// HOW THE NEAREST-OUTLET SEARCH WORKS
//
// Customer searches: ["Ganador Rice 25kg", "Surf Detergent 1kg", "Coke 1L"]
//
// Step 1 — Resolve item IDs from search terms
// Step 2 — Query OutletItemSearchIndex for all outlets that have ANY of those items
// Step 3 — For each outlet, calculate distance from customer GPS using Haversine
// Step 4 — Filter by delivery radius (outletDeliveryConfig.deliveryRadiusKm)
// Step 5 — Score each outlet: (matchCount / totalItems) + proximity bonus
// Step 6 — Return sorted list: outlets with 3/3 first, then 2/3, then 1/3
// Step 7 — Frontend renders pins on map, color-coded by match score
// Step 8 — Customer taps pin → opens outlet catalog filtered to matched items
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../prisma.js';
// ─── Haversine formula — distance between two GPS points in km ────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// ─── Main search function ─────────────────────────────────────────────────────
export async function findNearestOutletsWithItems(customerLat, customerLng, searchItems, maxResults = 10) {
    const itemIds = searchItems.map((i) => i.itemId);
    // ── Step 1: Query the search index for all outlets with any of the items ──
    // OutletItemSearchIndex is a denormalized flat table — much faster than
    // joining Outlet → Inventory → InventoryItems → Item for every search.
    const indexRows = await prisma.outletItemSearchIndex.findMany({
        where: {
            itemId: { in: itemIds },
            quantity: { gt: 0 }, // only in-stock items
            outlet: {
                isActive: true,
                deliveryConfig: {
                    isDeliveryActive: true,
                },
            },
        },
        include: {
            outlet: {
                include: {
                    deliveryConfig: true,
                },
            },
            item: {
                select: { id: true, name: true },
            },
        },
    });
    // ── Step 2: Group results by outlet ──────────────────────────────────────
    const outletMap = new Map();
    for (const row of indexRows) {
        const existing = outletMap.get(row.outletId) ?? [];
        existing.push(row);
        outletMap.set(row.outletId, existing);
    }
    // ── Step 3: Score and filter each outlet ─────────────────────────────────
    const results = [];
    for (const [outletId, rows] of outletMap.entries()) {
        const outlet = rows[0].outlet;
        const config = outlet.deliveryConfig;
        // Skip if outlet has no location data
        if (!outlet.latitude || !outlet.longitude)
            continue;
        // Calculate distance
        const distanceKm = haversineKm(customerLat, customerLng, outlet.latitude, outlet.longitude);
        // Skip if outside delivery radius
        const maxRadius = config?.deliveryRadiusKm ?? 5;
        if (distanceKm > maxRadius)
            continue;
        // Build matched/missing item lists
        const matchedItemIds = new Set(rows.map((r) => r.itemId));
        const matchedItems = rows.map((row) => {
            const wanted = searchItems.find((s) => s.itemId === row.itemId);
            return {
                itemId: row.itemId,
                itemName: row.item.name,
                price: row.price,
                stockQty: row.quantity,
                available: row.quantity >= wanted.quantityWanted,
            };
        });
        const missingItems = searchItems
            .filter((s) => !matchedItemIds.has(s.itemId))
            .map((s) => ({ itemId: s.itemId, itemName: s.name }));
        const matchCount = matchedItems.length;
        const totalItems = searchItems.length;
        // Delivery fee estimate: base + (distanceKm × feePerKm)
        const deliveryFeeEstimate = config
            ? Math.round(config.baseDeliveryFee + distanceKm * config.feePerKm)
            : 50;
        // Score formula:
        // - Match ratio (0-1) weighted at 70%
        // - Proximity (0-1, closer = higher) weighted at 30%
        // - Small penalty if any matched items are under requested quantity
        const allAvailable = matchedItems.every((m) => m.available);
        const availabilityPenalty = allAvailable ? 0 : 0.05;
        const matchRatio = matchCount / totalItems;
        const proximityScore = Math.max(0, 1 - distanceKm / maxRadius);
        const matchScore = matchRatio * 0.7 + proximityScore * 0.3 - availabilityPenalty;
        results.push({
            outletId,
            outletName: outlet.name,
            outletAddress: outlet.address,
            latitude: outlet.latitude,
            longitude: outlet.longitude,
            distanceKm: Math.round(distanceKm * 10) / 10,
            deliveryFeeEstimate,
            matchCount,
            totalItems,
            matchLabel: `${matchCount}/${totalItems} items`,
            matchScore,
            matchedItems,
            missingItems,
        });
    }
    // ── Step 4: Sort — full matches first, then by score desc ─────────────────
    results.sort((a, b) => {
        // Perfect matches always float to top
        if (b.matchCount === b.totalItems && a.matchCount < a.totalItems)
            return 1;
        if (a.matchCount === a.totalItems && b.matchCount < b.totalItems)
            return -1;
        return b.matchScore - a.matchScore;
    });
    return results.slice(0, maxResults);
}
// ─── Keep the search index fresh ─────────────────────────────────────────────
// Call this whenever inventory is updated (after a sale, after a restock).
// Also run as a cron job every 15 minutes as a safety net.
export async function refreshOutletItemSearchIndex(outletId) {
    const inventoryItems = await prisma.inventoryItems.findMany({
        where: {
            inventory: { outletId },
            quantity: { gt: 0 },
        },
        include: {
            inventory: {
                include: { outlet: true },
            },
            item: true,
        },
    });
    // Upsert each item into the search index
    await Promise.all(inventoryItems.map((inv) => prisma.outletItemSearchIndex.upsert({
        where: {
            outletId_itemId: {
                outletId: inv.inventory.outletId,
                itemId: inv.itemId,
            },
        },
        update: {
            quantity: inv.quantity,
            price: inv.price,
            outletLatitude: inv.inventory.outlet.latitude ?? 0,
            outletLongitude: inv.inventory.outlet.longitude ?? 0,
        },
        create: {
            outletId: inv.inventory.outletId,
            itemId: inv.itemId,
            inventoryItemId: inv.id,
            quantity: inv.quantity,
            price: inv.price,
            outletLatitude: inv.inventory.outlet.latitude ?? 0,
            outletLongitude: inv.inventory.outlet.longitude ?? 0,
        },
    })));
    // Remove items that are now out of stock from the index
    await prisma.outletItemSearchIndex.deleteMany({
        where: {
            outletId,
            itemId: {
                notIn: inventoryItems.map((i) => i.itemId),
            },
        },
    });
}
