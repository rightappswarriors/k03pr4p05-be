import { prisma } from '../lib/prisma.js';
import { Prisma, PrismaClient, SupplierInventoryMovementType, SupplierStockBatchStatus, SupplierIncomingStatus } from '@prisma/client'

type TxClient = Prisma.TransactionClient

// ────────────────────────────────────────────────────────────────────────
// INTERNAL: the one place rollup counters (availableQty, reservedQty,
// damagedQty, returnedQty, incomingQty) get written. Every mutation in this
// file goes through this — never update those fields anywhere else, or the
// movement ledger stops being the source of truth.
// ────────────────────────────────────────────────────────────────────────

interface RollupDelta {
    availableDelta?: number
    reservedDelta?: number
    damagedDelta?: number
    returnedDelta?: number
    incomingDelta?: number
}

interface PostMovementInput {
    supplierItemId: string
    warehouseId?: string | null
    batchId?: string | null
    type: SupplierInventoryMovementType
    quantity: number // magnitude, always positive — direction is conveyed by `type` + which rollup field moved
    unitCost?: number | null
    referenceType?: string | null
    referenceId?: string | null
    transferGroupId?: string | null
    reason?: string | null
    createdById?: number | null
    rollup: RollupDelta
}

async function postMovement(tx: TxClient, input: PostMovementInput) {
    if (input.quantity <= 0) throw new Error('VALIDATION: movement quantity must be > 0')

    const item = await tx.supplierItem.findUniqueOrThrow({ where: { id: input.supplierItemId } })

    const newAvailable = item.availableQty + (input.rollup.availableDelta ?? 0)
    const newReserved = item.reservedQty + (input.rollup.reservedDelta ?? 0)
    const newDamaged = item.damagedQty + (input.rollup.damagedDelta ?? 0)
    const newReturned = item.returnedQty + (input.rollup.returnedDelta ?? 0)
    const newIncoming = item.incomingQty + (input.rollup.incomingDelta ?? 0)

    if (newAvailable < -0.0001) throw new Error(`INSUFFICIENT_STOCK: available stock cannot go negative for item ${item.id}`)
    if (newReserved < -0.0001) throw new Error(`INVALID_RESERVATION: reserved stock cannot go negative for item ${item.id}`)

    await tx.supplierItem.update({
        where: { id: input.supplierItemId },
        data: {
            availableQty: Math.max(0, newAvailable),
            reservedQty: Math.max(0, newReserved),
            damagedQty: Math.max(0, newDamaged),
            returnedQty: Math.max(0, newReturned),
            incomingQty: Math.max(0, newIncoming),
        },
    })

    return tx.supplierInventoryMovement.create({
        data: {
            supplierItemId: input.supplierItemId,
            warehouseId: input.warehouseId ?? null,
            batchId: input.batchId ?? null,
            type: input.type,
            quantity: input.quantity,
            quantityBefore: item.availableQty,
            quantityAfter: Math.max(0, newAvailable),
            unitCost: input.unitCost ?? null,
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            transferGroupId: input.transferGroupId ?? null,
            reason: input.reason ?? null,
            createdById: input.createdById ?? null,
        },
    })
}

// ────────────────────────────────────────────────────────────────────────
// FIFO CONSUMPTION — the single place batches actually get drawn down.
// Used by sell/fulfill/damage/adjust-down/transfer. Oldest ACTIVE batch
// (by receivedAt) is consumed first.
// ────────────────────────────────────────────────────────────────────────

interface ConsumedChunk {
    batchId: string
    qty: number
    unitCost: number
    expiryDate: Date | null
}

async function consumeFifoBatches(
    tx: TxClient,
    supplierItemId: string,
    quantity: number,
    warehouseId?: string | null
): Promise<ConsumedChunk[]> {
    const batches = await tx.supplierStockBatch.findMany({
        where: {
            supplierItemId,
            status: SupplierStockBatchStatus.ACTIVE,
            remainingQty: { gt: 0 },
            deletedAt: null,
            ...(warehouseId ? { warehouseId } : {}),
        },
        orderBy: { receivedAt: 'asc' },
    })

    let remaining = quantity
    const consumed: ConsumedChunk[] = []

    for (const batch of batches) {
        if (remaining <= 0) break
        const take = Math.min(batch.remainingQty, remaining)
        consumed.push({ batchId: batch.id, qty: take, unitCost: batch.unitCost, expiryDate: batch.expiryDate })
        const newRemaining = batch.remainingQty - take
        await tx.supplierStockBatch.update({
            where: { id: batch.id },
            data: {
                remainingQty: newRemaining,
                status: newRemaining <= 0.0001 ? SupplierStockBatchStatus.DEPLETED : SupplierStockBatchStatus.ACTIVE,
            },
        })
        remaining -= take
    }

    if (remaining > 0.0001) {
        throw new Error(
            `INSUFFICIENT_BATCH_STOCK: ${remaining} unit(s) of item ${supplierItemId} have no batch coverage. ` +
            `availableQty and actual batch totals have drifted — run reconcileInventoryRollups for this item.`
        )
    }

    return consumed
}

// ────────────────────────────────────────────────────────────────────────
// VALUATION / AVERAGE COST — computed on demand from active batches, never
// stored (same principle as Wallet.balance being a maintained rollup with
// WalletLedgerEntry as the source of truth elsewhere in this schema).
// ────────────────────────────────────────────────────────────────────────

export async function getInventoryValuation(prisma: PrismaClient | TxClient, supplierItemId: string) {
    const batches = await prisma.supplierStockBatch.findMany({
        where: { supplierItemId, status: SupplierStockBatchStatus.ACTIVE, remainingQty: { gt: 0 }, deletedAt: null },
    })
    const totalQty = batches.reduce((s, b) => s + b.remainingQty, 0)
    const totalValue = batches.reduce((s, b) => s + b.remainingQty * b.unitCost, 0)
    const averageCost = totalQty > 0 ? totalValue / totalQty : 0
    return { totalQty, totalValue, averageCost, batchCount: batches.length }
}

async function computeAverageCost(tx: TxClient, supplierItemId: string): Promise<number | null> {
    const v = await getInventoryValuation(tx, supplierItemId)
    return v.totalQty > 0 ? v.averageCost : null
}

// ────────────────────────────────────────────────────────────────────────
// RECEIVE STOCK — creates a batch, posts RECEIVED, logs a cost-history
// entry if the item's average cost shifts as a result.
// ────────────────────────────────────────────────────────────────────────

export interface ReceiveStockInput {
    supplierItemId: string
    warehouseId?: string | null
    quantity: number
    unitCost: number
    batchNumber?: string | null
    expiryDate?: Date | null
    incomingStockId?: string | null // set when this receipt fulfills a logged SupplierIncomingStock
    referenceType?: string | null
    referenceId?: string | null
    createdById?: number | null
}

export async function receiveStock(prisma: PrismaClient, input: ReceiveStockInput) {
    if (input.quantity <= 0) throw new Error('VALIDATION: quantity must be > 0')
    if (input.unitCost < 0) throw new Error('VALIDATION: unitCost cannot be negative')

    return prisma.$transaction(async (tx) => {
        const oldAvgCost = await computeAverageCost(tx, input.supplierItemId)

        const batch = await tx.supplierStockBatch.create({
            data: {
                supplierItemId: input.supplierItemId,
                warehouseId: input.warehouseId ?? null,
                batchNumber: input.batchNumber ?? null,
                quantity: input.quantity,
                remainingQty: input.quantity,
                unitCost: input.unitCost,
                expiryDate: input.expiryDate ?? null,
                status: SupplierStockBatchStatus.ACTIVE,
            },
        })

        await postMovement(tx, {
            supplierItemId: input.supplierItemId,
            warehouseId: input.warehouseId,
            batchId: batch.id,
            type: SupplierInventoryMovementType.RECEIVED,
            quantity: input.quantity,
            unitCost: input.unitCost,
            referenceType: input.referenceType ?? (input.incomingStockId ? 'SupplierIncomingStock' : 'Manual'),
            referenceId: input.referenceId ?? input.incomingStockId ?? null,
            createdById: input.createdById,
            rollup: {
                availableDelta: input.quantity,
                incomingDelta: input.incomingStockId ? -input.quantity : 0,
            },
        })

        if (input.incomingStockId) {
            await tx.supplierIncomingStock.update({
                where: { id: input.incomingStockId },
                data: { status: SupplierIncomingStatus.RECEIVED, receivedBatchId: batch.id },
            })
        }

        const newAvgCost = await computeAverageCost(tx, input.supplierItemId)
        if (oldAvgCost !== null && newAvgCost !== null && Math.abs(newAvgCost - oldAvgCost) > 0.0001) {
            await tx.supplierItemCostHistory.create({
                data: {
                    supplierItemId: input.supplierItemId,
                    oldCost: oldAvgCost,
                    newCost: newAvgCost,
                    reason: 'Stock received',
                    changedById: input.createdById ?? null,
                },
            })
        } else if (oldAvgCost === null && newAvgCost !== null) {
            // first-ever batch — record the opening cost too, so the cost history chart has a starting point
            await tx.supplierItemCostHistory.create({
                data: {
                    supplierItemId: input.supplierItemId,
                    oldCost: newAvgCost,
                    newCost: newAvgCost,
                    reason: 'Initial stock received',
                    changedById: input.createdById ?? null,
                },
            })
        }

        return batch
    })
}

// ────────────────────────────────────────────────────────────────────────
// RESERVE / RELEASE — allocation against availableQty, no batch touched
// yet. Used when a MandateOffer/PurchaseOrder is accepted but not yet
// fulfilled/delivered.
// ────────────────────────────────────────────────────────────────────────

export async function reserveStock(
    prisma: PrismaClient,
    input: { supplierItemId: string; quantity: number; referenceType?: string; referenceId?: string; createdById?: number }
) {
    if (input.quantity <= 0) throw new Error('VALIDATION: quantity must be > 0')
    return prisma.$transaction((tx) =>
        postMovement(tx, {
            supplierItemId: input.supplierItemId,
            type: SupplierInventoryMovementType.RESERVED,
            quantity: input.quantity,
            referenceType: input.referenceType ?? 'Manual',
            referenceId: input.referenceId,
            createdById: input.createdById,
            rollup: { availableDelta: -input.quantity, reservedDelta: input.quantity },
        })
    )
}

export async function releaseReservation(
    prisma: PrismaClient,
    input: { supplierItemId: string; quantity: number; referenceType?: string; referenceId?: string; reason?: string; createdById?: number }
) {
    if (input.quantity <= 0) throw new Error('VALIDATION: quantity must be > 0')
    return prisma.$transaction((tx) =>
        postMovement(tx, {
            supplierItemId: input.supplierItemId,
            type: SupplierInventoryMovementType.RELEASED,
            quantity: input.quantity,
            referenceType: input.referenceType ?? 'Manual',
            referenceId: input.referenceId,
            reason: input.reason,
            createdById: input.createdById,
            rollup: { reservedDelta: -input.quantity, availableDelta: input.quantity },
        })
    )
}

// ────────────────────────────────────────────────────────────────────────
// FULFILL / SELL — actually draws down batches via FIFO. Two entry points:
// fulfillReservedStock (converts an existing reservation to a sale) and
// sellDirectStock (sale with no prior reservation).
// ────────────────────────────────────────────────────────────────────────

export async function fulfillReservedStock(
    prisma: PrismaClient,
    input: { supplierItemId: string; quantity: number; warehouseId?: string; referenceType?: string; referenceId?: string; createdById?: number }
) {
    if (input.quantity <= 0) throw new Error('VALIDATION: quantity must be > 0')
    return prisma.$transaction(async (tx) => {
        const consumed = await consumeFifoBatches(tx, input.supplierItemId, input.quantity, input.warehouseId)
        for (const chunk of consumed) {
            await postMovement(tx, {
                supplierItemId: input.supplierItemId,
                warehouseId: input.warehouseId,
                batchId: chunk.batchId,
                type: SupplierInventoryMovementType.SOLD,
                quantity: chunk.qty,
                unitCost: chunk.unitCost,
                referenceType: input.referenceType ?? 'Manual',
                referenceId: input.referenceId,
                createdById: input.createdById,
                rollup: { reservedDelta: -chunk.qty }, // availableQty already decremented at reservation time
            })
        }
        return consumed
    })
}

export async function sellDirectStock(
    prisma: PrismaClient,
    input: { supplierItemId: string; quantity: number; warehouseId?: string; referenceType?: string; referenceId?: string; createdById?: number }
) {
    if (input.quantity <= 0) throw new Error('VALIDATION: quantity must be > 0')
    return prisma.$transaction(async (tx) => {
        const consumed = await consumeFifoBatches(tx, input.supplierItemId, input.quantity, input.warehouseId)
        for (const chunk of consumed) {
            await postMovement(tx, {
                supplierItemId: input.supplierItemId,
                warehouseId: input.warehouseId,
                batchId: chunk.batchId,
                type: SupplierInventoryMovementType.SOLD,
                quantity: chunk.qty,
                unitCost: chunk.unitCost,
                referenceType: input.referenceType ?? 'Manual',
                referenceId: input.referenceId,
                createdById: input.createdById,
                rollup: { availableDelta: -chunk.qty },
            })
        }
        return consumed
    })
}

// ────────────────────────────────────────────────────────────────────────
// ADJUST — manual correction, either direction. Positive creates a new
// "Adjustment" batch (so the value is still valuation-tracked); negative
// consumes FIFO like a sale, just categorized differently for audit clarity.
// ────────────────────────────────────────────────────────────────────────

export async function adjustStock(
    prisma: PrismaClient,
    input: { supplierItemId: string; delta: number; unitCost?: number; warehouseId?: string; reason: string; createdById?: number }
) {
    if (input.delta === 0) throw new Error('VALIDATION: adjustment delta cannot be zero')

    return prisma.$transaction(async (tx) => {
        if (input.delta > 0) {
            const avgCost = input.unitCost ?? (await computeAverageCost(tx, input.supplierItemId)) ?? 0
            const batch = await tx.supplierStockBatch.create({
                data: {
                    supplierItemId: input.supplierItemId,
                    warehouseId: input.warehouseId ?? null,
                    batchNumber: 'ADJUSTMENT',
                    quantity: input.delta,
                    remainingQty: input.delta,
                    unitCost: avgCost,
                    status: SupplierStockBatchStatus.ACTIVE,
                },
            })
            return postMovement(tx, {
                supplierItemId: input.supplierItemId,
                warehouseId: input.warehouseId,
                batchId: batch.id,
                type: SupplierInventoryMovementType.ADJUSTED,
                quantity: input.delta,
                unitCost: avgCost,
                reason: input.reason,
                createdById: input.createdById,
                rollup: { availableDelta: input.delta },
            })
        } else {
            const qty = Math.abs(input.delta)
            const consumed = await consumeFifoBatches(tx, input.supplierItemId, qty, input.warehouseId)
            let lastMovement
            for (const chunk of consumed) {
                lastMovement = await postMovement(tx, {
                    supplierItemId: input.supplierItemId,
                    warehouseId: input.warehouseId,
                    batchId: chunk.batchId,
                    type: SupplierInventoryMovementType.ADJUSTED,
                    quantity: chunk.qty,
                    unitCost: chunk.unitCost,
                    reason: input.reason,
                    createdById: input.createdById,
                    rollup: { availableDelta: -chunk.qty },
                })
            }
            return lastMovement
        }
    })
}

// ────────────────────────────────────────────────────────────────────────
// DAMAGE / RETURN — damage draws down real batches (physical loss).
// Return is a two-step flow: markReturned flags qty as pending inspection
// (doesn't touch availableQty/batches), restockReturnedItem later decides
// to put it back into sellable stock (creates a batch) — matches how
// returns actually work operationally (inspect before re-shelving).
// ────────────────────────────────────────────────────────────────────────

export async function markDamaged(
    prisma: PrismaClient,
    input: { supplierItemId: string; quantity: number; warehouseId?: string; reason: string; createdById?: number }
) {
    if (input.quantity <= 0) throw new Error('VALIDATION: quantity must be > 0')
    return prisma.$transaction(async (tx) => {
        const consumed = await consumeFifoBatches(tx, input.supplierItemId, input.quantity, input.warehouseId)
        for (const chunk of consumed) {
            await postMovement(tx, {
                supplierItemId: input.supplierItemId,
                warehouseId: input.warehouseId,
                batchId: chunk.batchId,
                type: SupplierInventoryMovementType.DAMAGED,
                quantity: chunk.qty,
                unitCost: chunk.unitCost,
                reason: input.reason,
                createdById: input.createdById,
                rollup: { availableDelta: -chunk.qty, damagedDelta: chunk.qty },
            })
        }
        return consumed
    })
}

export async function markReturned(
    prisma: PrismaClient,
    input: { supplierItemId: string; quantity: number; referenceType?: string; referenceId?: string; reason?: string; createdById?: number }
) {
    if (input.quantity <= 0) throw new Error('VALIDATION: quantity must be > 0')
    return prisma.$transaction((tx) =>
        postMovement(tx, {
            supplierItemId: input.supplierItemId,
            type: SupplierInventoryMovementType.RETURNED,
            quantity: input.quantity,
            referenceType: input.referenceType ?? 'Manual',
            referenceId: input.referenceId,
            reason: input.reason,
            createdById: input.createdById,
            rollup: { returnedDelta: input.quantity },
        })
    )
}

export async function restockReturnedItem(
    prisma: PrismaClient,
    input: { supplierItemId: string; quantity: number; unitCost: number; warehouseId?: string; createdById?: number }
) {
    if (input.quantity <= 0) throw new Error('VALIDATION: quantity must be > 0')
    return prisma.$transaction(async (tx) => {
        const item = await tx.supplierItem.findUniqueOrThrow({ where: { id: input.supplierItemId } })
        if (item.returnedQty < input.quantity) throw new Error('VALIDATION: cannot restock more than currently returned quantity')

        const batch = await tx.supplierStockBatch.create({
            data: {
                supplierItemId: input.supplierItemId,
                warehouseId: input.warehouseId ?? null,
                batchNumber: 'RESTOCKED_RETURN',
                quantity: input.quantity,
                remainingQty: input.quantity,
                unitCost: input.unitCost,
                status: SupplierStockBatchStatus.ACTIVE,
            },
        })

        return postMovement(tx, {
            supplierItemId: input.supplierItemId,
            warehouseId: input.warehouseId,
            batchId: batch.id,
            type: SupplierInventoryMovementType.RECEIVED,
            quantity: input.quantity,
            unitCost: input.unitCost,
            referenceType: 'ReturnedStockRestock',
            createdById: input.createdById,
            rollup: { returnedDelta: -input.quantity, availableDelta: input.quantity },
        })
    })
}

// ────────────────────────────────────────────────────────────────────────
// TRANSFER — relocates physical batches between warehouses. Nets to zero
// on availableQty (transfers don't change total stock, only location), but
// still posts a full paired audit trail with a shared transferGroupId.
// ────────────────────────────────────────────────────────────────────────

export async function transferStock(
    prisma: PrismaClient,
    input: { supplierItemId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; reason?: string; createdById?: number }
) {
    if (input.quantity <= 0) throw new Error('VALIDATION: quantity must be > 0')
    if (input.fromWarehouseId === input.toWarehouseId) throw new Error('VALIDATION: source and destination warehouse must differ')

    const transferGroupId = `xfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    return prisma.$transaction(async (tx) => {
        const consumed = await consumeFifoBatches(tx, input.supplierItemId, input.quantity, input.fromWarehouseId)
        const results = []

        for (const chunk of consumed) {
            await postMovement(tx, {
                supplierItemId: input.supplierItemId,
                warehouseId: input.fromWarehouseId,
                batchId: chunk.batchId,
                type: SupplierInventoryMovementType.TRANSFERRED_OUT,
                quantity: chunk.qty,
                unitCost: chunk.unitCost,
                transferGroupId,
                reason: input.reason,
                createdById: input.createdById,
                rollup: { availableDelta: -chunk.qty },
            })

            const newBatch = await tx.supplierStockBatch.create({
                data: {
                    supplierItemId: input.supplierItemId,
                    warehouseId: input.toWarehouseId,
                    batchNumber: 'TRANSFERRED',
                    quantity: chunk.qty,
                    remainingQty: chunk.qty,
                    unitCost: chunk.unitCost,
                    expiryDate: chunk.expiryDate,
                    status: SupplierStockBatchStatus.ACTIVE,
                },
            })

            await postMovement(tx, {
                supplierItemId: input.supplierItemId,
                warehouseId: input.toWarehouseId,
                batchId: newBatch.id,
                type: SupplierInventoryMovementType.TRANSFERRED_IN,
                quantity: chunk.qty,
                unitCost: chunk.unitCost,
                transferGroupId,
                reason: input.reason,
                createdById: input.createdById,
                rollup: { availableDelta: chunk.qty },
            })

            results.push(newBatch)
        }

        return results
    })
}

// ────────────────────────────────────────────────────────────────────────
// INCOMING STOCK — lightweight expected-shipment logging (not a full
// upstream procurement system). receiveIncomingStock() delegates to
// receiveStock() so it goes through the same batch/cost-history path.
// ────────────────────────────────────────────────────────────────────────

export async function logIncomingStock(
    prisma: PrismaClient,
    input: { supplierItemId: string; warehouseId?: string; expectedQty: number; expectedDate?: Date; sourceLabel?: string; notes?: string; createdById?: number }
) {
    if (input.expectedQty <= 0) throw new Error('VALIDATION: expectedQty must be > 0')
    return prisma.$transaction(async (tx) => {
        const incoming = await tx.supplierIncomingStock.create({
            data: {
                supplierItemId: input.supplierItemId,
                warehouseId: input.warehouseId ?? null,
                expectedQty: input.expectedQty,
                expectedDate: input.expectedDate ?? null,
                sourceLabel: input.sourceLabel ?? null,
                notes: input.notes ?? null,
                createdById: input.createdById ?? null,
                status: SupplierIncomingStatus.PENDING,
            },
        })
        await tx.supplierItem.update({
            where: { id: input.supplierItemId },
            data: { incomingQty: { increment: input.expectedQty } },
        })
        return incoming
    })
}

export async function cancelIncomingStock(prisma: PrismaClient, incomingStockId: string) {
    return prisma.$transaction(async (tx) => {
        const incoming = await tx.supplierIncomingStock.findUniqueOrThrow({ where: { id: incomingStockId } })
        if (incoming.status !== SupplierIncomingStatus.PENDING) throw new Error('VALIDATION: only PENDING incoming stock can be cancelled')
        await tx.supplierIncomingStock.update({ where: { id: incomingStockId }, data: { status: SupplierIncomingStatus.CANCELLED } })
        await tx.supplierItem.update({ where: { id: incoming.supplierItemId }, data: { incomingQty: { decrement: incoming.expectedQty } } })
        return incoming
    })
}

export async function receiveIncomingStock(
    prisma: PrismaClient,
    input: { incomingStockId: string; unitCost: number; batchNumber?: string; expiryDate?: Date; createdById?: number }
) {
    const incoming = await prisma.supplierIncomingStock.findUniqueOrThrow({ where: { id: input.incomingStockId } })
    if (incoming.status !== SupplierIncomingStatus.PENDING) throw new Error('VALIDATION: this incoming stock has already been received or cancelled')

    return receiveStock(prisma, {
        supplierItemId: incoming.supplierItemId,
        warehouseId: incoming.warehouseId,
        quantity: incoming.expectedQty,
        unitCost: input.unitCost,
        batchNumber: input.batchNumber,
        expiryDate: input.expiryDate,
        incomingStockId: incoming.id,
        createdById: input.createdById,
    })
}

// ────────────────────────────────────────────────────────────────────────
// RECONCILIATION — recomputes availableQty/reservedQty/damagedQty/
// returnedQty from the movement ledger and corrects drift. Same principle
// as the nightly ledger-reconciliation job described for Wallet elsewhere
// in this schema. Run per-item on demand, or scheduled across all items.
// ────────────────────────────────────────────────────────────────────────

export async function reconcileInventoryRollups(prisma: PrismaClient, supplierItemId: string) {
    return prisma.$transaction(async (tx) => {
        const movements = await tx.supplierInventoryMovement.findMany({
            where: { supplierItemId, deletedAt: null },
        })

        let available = 0
        let reserved = 0
        let damaged = 0
        let returned = 0

        for (const m of movements) {
            switch (m.type) {
                case SupplierInventoryMovementType.RECEIVED:
                case SupplierInventoryMovementType.TRANSFERRED_IN:
                    available += m.quantity
                    break
                case SupplierInventoryMovementType.SOLD:
                case SupplierInventoryMovementType.TRANSFERRED_OUT:
                    available -= m.quantity
                    break
                case SupplierInventoryMovementType.RESERVED:
                    available -= m.quantity
                    reserved += m.quantity
                    break
                case SupplierInventoryMovementType.RELEASED:
                    available += m.quantity
                    reserved -= m.quantity
                    break
                case SupplierInventoryMovementType.DAMAGED:
                    available -= m.quantity
                    damaged += m.quantity
                    break
                case SupplierInventoryMovementType.RETURNED:
                    returned += m.quantity
                    break
                case SupplierInventoryMovementType.ADJUSTED:
                    // ADJUSTED's sign is implicit in whether it paired with a positive
                    // batch creation or a FIFO consumption — quantityAfter - quantityBefore
                    // on the movement row tells us the true signed effect actually applied.
                    available += (m.quantityAfter - m.quantityBefore)
                    break
                case SupplierInventoryMovementType.EXPIRED:
                    available -= m.quantity
                    break
            }
        }

        const incomingAgg = await tx.supplierIncomingStock.aggregate({
            where: { supplierItemId, status: SupplierIncomingStatus.PENDING, deletedAt: null },
            _sum: { expectedQty: true },
        })

        const before = await tx.supplierItem.findUniqueOrThrow({ where: { id: supplierItemId } })
        const after = await tx.supplierItem.update({
            where: { id: supplierItemId },
            data: {
                availableQty: Math.max(0, available),
                reservedQty: Math.max(0, reserved),
                damagedQty: Math.max(0, damaged),
                returnedQty: Math.max(0, returned),
                incomingQty: incomingAgg._sum.expectedQty ?? 0,
            },
        })

        return {
            before: { availableQty: before.availableQty, reservedQty: before.reservedQty, damagedQty: before.damagedQty, returnedQty: before.returnedQty, incomingQty: before.incomingQty },
            after: { availableQty: after.availableQty, reservedQty: after.reservedQty, damagedQty: after.damagedQty, returnedQty: after.returnedQty, incomingQty: after.incomingQty },
            driftDetected:
                before.availableQty !== after.availableQty ||
                before.reservedQty !== after.reservedQty ||
                before.damagedQty !== after.damagedQty ||
                before.returnedQty !== after.returnedQty,
        }
    })
}

// ────────────────────────────────────────────────────────────────────────
// ONE-TIME BACKFILL — run once after this module ships. Creates an
// "Opening Balance" batch for any SupplierItem that has availableQty > 0
// but zero batches (pre-inventory-module data), using the item's own
// unitPrice as a cost placeholder since no real cost was ever recorded.
// After running this, every SupplierItem's availableQty is FIFO-backed.
// ────────────────────────────────────────────────────────────────────────

export async function backfillOpeningBalances(prisma: PrismaClient) {
    const items = await prisma.supplierItem.findMany({
        where: { availableQty: { gt: 0 }, deletedAt: null },
        include: { _count: { select: {} } },
    })

    const results: Array<{ supplierItemId: string; qty: number }> = []

    for (const item of items) {
        const batchCount = await prisma.supplierStockBatch.count({ where: { supplierItemId: item.id, deletedAt: null } })
        if (batchCount > 0) continue // already has batches, skip

        await prisma.$transaction(async (tx) => {
            const batch = await tx.supplierStockBatch.create({
                data: {
                    supplierItemId: item.id,
                    batchNumber: 'OPENING_BALANCE',
                    quantity: item.availableQty,
                    remainingQty: item.availableQty,
                    unitCost: item.unitPrice, // placeholder — no real cost was ever recorded pre-migration
                    status: SupplierStockBatchStatus.ACTIVE,
                },
            })
            await tx.supplierInventoryMovement.create({
                data: {
                    supplierItemId: item.id,
                    batchId: batch.id,
                    type: SupplierInventoryMovementType.RECEIVED,
                    quantity: item.availableQty,
                    quantityBefore: 0,
                    quantityAfter: item.availableQty,
                    unitCost: item.unitPrice,
                    referenceType: 'Backfill',
                    reason: 'Opening balance backfill — pre-dates Inventory module',
                },
            })
        })

        results.push({ supplierItemId: item.id, qty: item.availableQty })
    }

    return results
}

// ────────────────────────────────────────────────────────────────────────
// FORECAST — computed from real SOLD movements, not a stored table.
// ────────────────────────────────────────────────────────────────────────

export async function getInventoryForecast(prisma: PrismaClient, supplierItemId: string, trailingDays = 30) {
    const item = await prisma.supplierItem.findUniqueOrThrow({ where: { id: supplierItemId } })
    const since = new Date(Date.now() - trailingDays * 24 * 60 * 60 * 1000)

    const soldMovements = await prisma.supplierInventoryMovement.findMany({
        where: { supplierItemId, type: SupplierInventoryMovementType.SOLD, createdAt: { gte: since }, deletedAt: null },
    })

    const totalSold = soldMovements.reduce((s, m) => s + m.quantity, 0)
    const hasData = soldMovements.length > 0
    const avgDailyConsumption = hasData ? totalSold / trailingDays : null

    const daysRemaining = avgDailyConsumption && avgDailyConsumption > 0 ? item.availableQty / avgDailyConsumption : null
    const expectedStockoutDate = daysRemaining !== null ? new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000) : null

    const reorderLevel = item.reorderLevel
    const reorderQty = item.reorderQty
    const suggestedReorderDate =
        daysRemaining !== null && reorderLevel !== null && avgDailyConsumption
            ? new Date(Date.now() + Math.max(0, (item.availableQty - reorderLevel) / avgDailyConsumption) * 24 * 60 * 60 * 1000)
            : null

    return {
        hasData,
        avgDailyConsumption,
        daysRemaining,
        expectedStockoutDate,
        suggestedReorderQty: reorderQty,
        suggestedReorderDate,
        isLowStockPredicted: reorderLevel !== null ? item.availableQty <= reorderLevel : null,
    }
}

// ────────────────────────────────────────────────────────────────────────
// ANALYTICS — inventory-side only (cost/margin/aging), pairs with the
// existing supplierAnalyticsService for revenue-side numbers.
// ────────────────────────────────────────────────────────────────────────

export async function getInventoryAnalytics(prisma: PrismaClient, supplierItemId: string) {
    const item = await prisma.supplierItem.findUniqueOrThrow({ where: { id: supplierItemId } })
    const valuation = await getInventoryValuation(prisma, supplierItemId)

    const batches = await prisma.supplierStockBatch.findMany({
        where: { supplierItemId, deletedAt: null, remainingQty: { gt: 0 } },
    })
    const costs = batches.map((b) => b.unitCost)
    const highestCost = costs.length ? Math.max(...costs) : null
    const lowestCost = costs.length ? Math.min(...costs) : null

    const margin = valuation.averageCost > 0 ? ((item.unitPrice - valuation.averageCost) / item.unitPrice) * 100 : null
    const estimatedProfit = valuation.averageCost > 0 ? (item.unitPrice - valuation.averageCost) * valuation.totalQty : null

    const now = Date.now()
    const agingBuckets = { fresh: 0, aging: 0, old: 0, stale: 0 } // 0-30 / 31-60 / 61-90 / 90+ days
    for (const b of batches) {
        const ageDays = (now - b.receivedAt.getTime()) / (1000 * 60 * 60 * 24)
        if (ageDays <= 30) agingBuckets.fresh += b.remainingQty
        else if (ageDays <= 60) agingBuckets.aging += b.remainingQty
        else if (ageDays <= 90) agingBuckets.old += b.remainingQty
        else agingBuckets.stale += b.remainingQty
    }

    const avgDaysInStock =
        batches.length > 0
            ? batches.reduce((s, b) => s + (now - b.receivedAt.getTime()) / (1000 * 60 * 60 * 24) * b.remainingQty, 0) / valuation.totalQty
            : null

    // Turnover: COGS (sold qty * cost, trailing 90d) / average inventory value
    const since90 = new Date(now - 90 * 24 * 60 * 60 * 1000)
    const soldMovements = await prisma.supplierInventoryMovement.findMany({
        where: { supplierItemId, type: SupplierInventoryMovementType.SOLD, createdAt: { gte: since90 }, deletedAt: null },
    })
    const cogs = soldMovements.reduce((s, m) => s + m.quantity * (m.unitCost ?? 0), 0)
    const inventoryTurnover = valuation.totalValue > 0 ? cogs / valuation.totalValue : null

    return {
        inventoryValue: valuation.totalValue,
        averageCost: valuation.averageCost,
        highestCost,
        lowestCost,
        inventoryTurnover,
        avgDaysInStock,
        estimatedProfit,
        marginPct: margin,
        stockAging: agingBuckets,
        batchDistribution: batches.map((b) => ({ batchId: b.id, batchNumber: b.batchNumber, remainingQty: b.remainingQty, unitCost: b.unitCost })),
    }
}

// ────────────────────────────────────────────────────────────────────────
// ORG-WIDE DASHBOARD — the KPI row across the whole catalog.
// ────────────────────────────────────────────────────────────────────────

export async function getSupplierInventoryDashboard(prisma: PrismaClient, orgId: number) {
    const catalog = await prisma.supplierCatalog.findUnique({
        where: { organizationId: orgId },
        include: { items: { where: { isActive: true, deletedAt: null } } },
    })
    const items = catalog?.items ?? []
    const itemIds = items.map((i) => i.id)

    const totalInventory = items.reduce((s, i) => s + i.availableQty, 0)
    const availableStock = totalInventory
    const reservedStock = items.reduce((s, i) => s + i.reservedQty, 0)
    const incomingStock = items.reduce((s, i) => s + i.incomingQty, 0)
    const lowStockCount = items.filter((i) => i.reorderLevel !== null && i.availableQty <= (i.reorderLevel ?? 0)).length
    const outOfStockCount = items.filter((i) => i.availableQty <= 0).length

    const batches = itemIds.length
        ? await prisma.supplierStockBatch.findMany({
            where: { supplierItemId: { in: itemIds }, status: 'ACTIVE', remainingQty: { gt: 0 }, deletedAt: null },
        })
        : []

    const inventoryValue = batches.reduce((s, b) => s + b.remainingQty * b.unitCost, 0)
    const totalBatchQty = batches.reduce((s, b) => s + b.remainingQty, 0)
    const averageInventoryCost = totalBatchQty > 0 ? inventoryValue / totalBatchQty : 0

    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const expiringSoonCount = batches.filter((b) => b.expiryDate && b.expiryDate <= soon).length

    const marginable = items.filter((i) => i.unitPrice > 0)
    let averageMargin: number | null = null
    if (marginable.length > 0 && totalBatchQty > 0) {
        const margins = marginable.map((i) => {
            const itemBatches = batches.filter((b) => b.supplierItemId === i.id)
            const qty = itemBatches.reduce((s, b) => s + b.remainingQty, 0)
            const cost = qty > 0 ? itemBatches.reduce((s, b) => s + b.remainingQty * b.unitCost, 0) / qty : 0
            return cost > 0 ? ((i.unitPrice - cost) / i.unitPrice) * 100 : null
        }).filter((m): m is number => m !== null)
        averageMargin = margins.length ? margins.reduce((s, m) => s + m, 0) / margins.length : null
    }

    return {
        totalInventory,
        inventoryValue,
        availableStock,
        reservedStock,
        incomingStock,
        lowStockCount,
        outOfStockCount,
        expiringSoonCount,
        averageInventoryCost,
        averageMargin,
        // Turnover/avg-days-in-inventory are per-item (see getInventoryAnalytics) —
        // org-wide aggregates of those are expensive to compute live across every
        // item; left as a TODO for a scheduled rollup table if this needs to scale.
    }
}