type TxClient = any;

function assertPositiveQuantity(quantity: number, label: string) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`${label} quantity must be greater than zero.`);
  }
}

async function deductInventoryItem(tx: TxClient, inventoryItemId: number, quantity: number, itemId: number, options?: { unitId?: number | null }, outletName?: string) {
  assertPositiveQuantity(quantity, "Sold");

  const inventoryItem = await tx.inventoryItems.findUnique({
    where: { id: inventoryItemId },
    include: { item: true },
  });
  if (!inventoryItem) throw new Error(`Inventory item ${inventoryItemId} not found.`);

  let baseQuantityToDeduct = quantity;
  if (options?.unitId) {
    const unit = await tx.inventoryItemUnit.findUnique({
      where: { id: options.unitId },
    });
    if (!unit || unit.inventoryItemId !== inventoryItemId) {
      throw new Error(`Inventory unit ${options.unitId} does not belong to inventory item ${inventoryItemId}.`);
    }
    if (Number(unit.quantity) < quantity) {
      throw new Error(`Insufficient stock for ${inventoryItem.item.name} (${unit.unitLabel})${outletName ? ` in ${outletName}` : ''}.`);
    }
    await tx.inventoryItemUnit.update({
      where: { id: unit.id },
      data: { quantity: { decrement: quantity } },
    });
    baseQuantityToDeduct = quantity * Number(unit.conversionFactor || 1);

  }
  // ASK sir PAUL for changes if putting throw new Error here is correct or not, since the inventory deduction is in a transaction, it will automatically rollback if an error is thrown, but if we want to just skip the deduction for that item and continue with the next items, we can just return from the function instead of throwing an error
  if (Number(inventoryItem.quantity) < baseQuantityToDeduct) {
    throw new Error(`Insufficient stock for ${inventoryItem.item.name}${outletName ? ` in ${outletName}` : ''}.`);
  } /** 
  const itemRecord = await tx.item.findUnique({
    where: { id: itemId },
    select: { stock: true, name: true },
  });
  if (!itemRecord) throw new Error(`Item ${itemId} not found.`);

  if (Number(itemRecord.quantity) < baseQuantityToDeduct) {
    throw new Error(`Insufficient stock for ${itemRecord.name}${outletName ? ` in ${outletName}` : ''}.`);
  }}*/
    await tx.inventoryItems.update({
      where: { id: inventoryItemId },
      data: { quantity: { decrement: baseQuantityToDeduct } },
    });
    await tx.item.update({
      where: { id: itemId },
      data: { stock: { decrement: baseQuantityToDeduct } },
    });
  }

  export async function deductSalesOrderInventory(tx: TxClient, salesOrderId: string) {
    const claimedAt = new Date();
    const claim = await tx.salesOrder.updateMany({
      where: { id: salesOrderId, inventoryDeductedAt: null },
      data: { inventoryDeductedAt: claimedAt },
    });
    if (claim.count === 0) return false;

    const order = await tx.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        outlet: { include: { inventory: true } },
        items: true,
      },
    });

    if (!order) throw new Error("Sales order not found.");
    // Decrement stock for each item in the order. If outlet has no inventory, skip inventory deduction and just check item stock. This is for the use case of sales orders created before the inventory feature was implemented, where outlets may not have inventory records yet.
    if (!order.outlet?.inventory) {
      for (const item of order.items) {
        if (item.isCustomItem || !item.itemId) continue;
        const quantity = Number(item.quantity);
        assertPositiveQuantity(quantity, "Sales order item");
        const itemQuantity = await tx.item.findUnique({
          where: { id: item.itemId },
          select: { stock: true, name: true },
        })
        if (!itemQuantity) throw new Error(`Item ${item.itemId} not found.`);
        if (Number(itemQuantity.stock) < quantity) {
          throw new Error(`Insufficient stock for ${itemQuantity.name}.`);
        }
        await tx.item.update({
          where: { id: item.itemId },
          data: { stock: { decrement: quantity } },
        });
        return true
      }
    }

    for (const item of order.items) {
      if (item.isCustomItem || !item.itemId) continue;
      const quantity = Number(item.quantity);
      assertPositiveQuantity(quantity, "Sales order item");

      let inventoryItemId: number | null = null;
      if (item.unitId) {
        const unit = await tx.inventoryItemUnit.findUnique({
          where: { id: item.unitId },
          select: { id: true, inventoryItemId: true },
        });
        if (!unit) throw new Error(`Inventory unit ${item.unitId} not found.`);
        inventoryItemId = unit.inventoryItemId;
      } else {
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

      await deductInventoryItem(tx, inventoryItemId, quantity, item.itemId, { unitId: item.unitId }, order.outlet.name);
    }

    return true;
  }


  export async function deductKompraOrderInventory(tx: TxClient, orderId: number) {
    const claimedAt = new Date();
    const claim = await tx.kompraCOrder.updateMany({
      where: { id: orderId, inventoryDeductedAt: null },
      data: { inventoryDeductedAt: claimedAt },
      include: { outlet: true }
    });
    if (claim.count === 0) return false;

    const orderItems = await tx.kompraCOrderItem.findMany({ where: { orderId } });
    for (const item of orderItems) {
      await deductInventoryItem(tx, item.inventoryItemId, Number(item.quantity), item.itemId, { unitId: item.unitId }, claim.outlet.name);
    }

    return true;
  }
