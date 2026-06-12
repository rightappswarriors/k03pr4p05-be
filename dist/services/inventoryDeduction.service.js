function assertPositiveQuantity(quantity, label) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`${label} quantity must be greater than zero.`);
    }
}
async function deductInventoryItem(tx, inventoryItemId, quantity, options) {
    assertPositiveQuantity(quantity, "Sold");
    const inventoryItem = await tx.inventoryItems.findUnique({
        where: { id: inventoryItemId },
        include: { item: true },
    });
    if (!inventoryItem)
        throw new Error(`Inventory item ${inventoryItemId} not found.`);
    let baseQuantityToDeduct = quantity;
    if (options?.unitId) {
        const unit = await tx.inventoryItemUnit.findUnique({
            where: { id: options.unitId },
        });
        if (!unit || unit.inventoryItemId !== inventoryItemId) {
            throw new Error(`Inventory unit ${options.unitId} does not belong to inventory item ${inventoryItemId}.`);
        }
        if (Number(unit.quantity) < quantity) {
            throw new Error(`Insufficient stock for ${inventoryItem.item.name} (${unit.unitLabel}).`);
        }
        await tx.inventoryItemUnit.update({
            where: { id: unit.id },
            data: { quantity: { decrement: quantity } },
        });
        baseQuantityToDeduct = quantity * Number(unit.conversionFactor || 1);
    }
    if (Number(inventoryItem.quantity) < baseQuantityToDeduct) {
        throw new Error(`Insufficient stock for ${inventoryItem.item.name}.`);
    }
    await tx.inventoryItems.update({
        where: { id: inventoryItemId },
        data: { quantity: { decrement: baseQuantityToDeduct } },
    });
}
export async function deductSalesOrderInventory(tx, salesOrderId) {
    const claimedAt = new Date();
    const claim = await tx.salesOrder.updateMany({
        where: { id: salesOrderId, inventoryDeductedAt: null },
        data: { inventoryDeductedAt: claimedAt },
    });
    if (claim.count === 0)
        return false;
    const order = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: {
            outlet: { include: { inventory: true } },
            items: true,
        },
    });
    if (!order)
        throw new Error("Sales order not found.");
    if (!order.outlet?.inventory)
        throw new Error("Sales order outlet inventory not found.");
    for (const item of order.items) {
        if (item.isCustomItem || !item.itemId)
            continue;
        const quantity = Number(item.quantity);
        assertPositiveQuantity(quantity, "Sales order item");
        let inventoryItemId = null;
        if (item.unitId) {
            const unit = await tx.inventoryItemUnit.findUnique({
                where: { id: item.unitId },
                select: { id: true, inventoryItemId: true },
            });
            if (!unit)
                throw new Error(`Inventory unit ${item.unitId} not found.`);
            inventoryItemId = unit.inventoryItemId;
        }
        else {
            const inventoryItem = await tx.inventoryItems.findFirst({
                where: {
                    inventoryId: order.outlet.inventory.id,
                    itemId: item.itemId,
                },
                select: { id: true },
            });
            inventoryItemId = inventoryItem?.id ?? null;
        }
        if (!inventoryItemId) {
            throw new Error(`Inventory record not found for item ${item.itemId}.`);
        }
        await deductInventoryItem(tx, inventoryItemId, quantity, { unitId: item.unitId });
    }
    return true;
}
export async function deductKompraOrderInventory(tx, orderId) {
    const claimedAt = new Date();
    const claim = await tx.kompraCOrder.updateMany({
        where: { id: orderId, inventoryDeductedAt: null },
        data: { inventoryDeductedAt: claimedAt },
    });
    if (claim.count === 0)
        return false;
    const orderItems = await tx.kompraCOrderItem.findMany({ where: { orderId } });
    for (const item of orderItems) {
        await deductInventoryItem(tx, item.inventoryItemId, Number(item.quantity), { unitId: item.unitId });
    }
    return true;
}
