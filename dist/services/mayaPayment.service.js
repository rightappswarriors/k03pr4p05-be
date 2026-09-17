import { randomUUID } from 'node:crypto';
import { settleSuccessfulPayment } from './platformWallet.service.js';
import { isPurchaseOrderPaymentReady } from './purchaseOrderPolicy.service.js';
import { requireRetailerOrganization } from './supplierLink.service.js';
const OPEN_STATUSES = ['PENDING', 'AWAITING_PAYMENT', 'PROCESSING', 'RECONCILIATION_REQUIRED'];
const TERMINAL_STATUSES = ['FAILED', 'CANCELLED', 'EXPIRED'];
const CHECKOUT_SESSION_LIFETIME_MS = 60 * 60 * 1000;
const CHECKOUT_REUSE_WINDOW_MS = Math.min(CHECKOUT_SESSION_LIFETIME_MS, Math.max(0, Number(process.env.MAYA_CHECKOUT_REUSE_MINUTES ?? 55) * 60 * 1000));
export function isRetailerPurchaseOrderPaymentEligible(po) {
    return isPurchaseOrderPaymentReady(po);
}
function mayaHost() {
    return process.env.PAYMENT_ENV === 'PRODUCTION' ? 'https://pg.maya.ph' : 'https://pg-sandbox.paymaya.com';
}
function mayaPublicKey() {
    const value = process.env.MAYA_PUBLIC_KEY?.trim();
    if (!value)
        throw new Error('Maya Checkout is not configured.');
    return value;
}
function basicAuthorization() {
    return `Basic ${Buffer.from(`${mayaPublicKey()}:`).toString('base64')}`;
}
export function normalizeMayaEvent(body) {
    const rawStatus = String(body.paymentStatus ?? body.status ?? '').toUpperCase();
    const status = body.isPaid === true || rawStatus === 'PAYMENT_SUCCESS' || rawStatus.includes('SUCCESS') || rawStatus === 'CAPTURED'
        ? 'SUCCEEDED'
        : rawStatus.includes('EXPIRED') || rawStatus.includes('DROPOUT')
            ? 'EXPIRED'
            : rawStatus.includes('CANCEL')
                ? 'CANCELLED'
                : rawStatus.includes('FAIL')
                    ? 'FAILED'
                    : rawStatus.includes('PROCESS') || rawStatus.includes('AUTH')
                        ? 'PROCESSING'
                        : 'AWAITING_PAYMENT';
    const requestReferenceNumber = typeof (body.requestReferenceNumber ?? body.metadata?.requestReferenceNumber) === 'string'
        ? String(body.requestReferenceNumber ?? body.metadata?.requestReferenceNumber).trim()
        : undefined;
    return {
        eventId: String(body.id ?? body.paymentId ?? body.checkoutId ?? ''),
        providerReference: String(body.checkoutId ?? body.paymentId ?? body.id ?? ''),
        requestReferenceNumber: requestReferenceNumber || undefined,
        status,
        amount: Number(body.totalAmount?.value ?? body.amount?.value ?? body.amount ?? 0),
        currency: String(body.totalAmount?.currency ?? body.amount?.currency ?? body.currency ?? 'PHP').toUpperCase(),
        occurredAt: new Date(body.updatedAt ?? body.createdAt ?? Date.now()),
        metadata: body,
    };
}
async function createMayaCheckout(input) {
    const successUrl = process.env.MAYA_SUCCESS_URL?.trim();
    const cancelUrl = process.env.MAYA_CANCEL_URL?.trim();
    if (!successUrl || !cancelUrl)
        throw new Error('Maya Checkout return URLs are not configured.');
    const withTransaction = (value, result) => {
        const url = new URL(value);
        url.searchParams.set('transactionId', input.transactionId);
        url.searchParams.set('result', result);
        return url.toString();
    };
    const response = await fetch(`${mayaHost()}/checkout/v1/checkouts`, {
        method: 'POST',
        headers: { Authorization: basicAuthorization(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
            totalAmount: { value: Math.round(input.amount * 100) / 100, currency: 'PHP' },
            buyer: {},
            items: [{ name: `Purchase Order ${input.poNumber}`, quantity: 1, totalAmount: { value: Math.round(input.amount * 100) / 100, currency: 'PHP' } }],
            requestReferenceNumber: input.transactionId,
            redirectUrl: { success: withTransaction(successUrl, 'success'), failure: withTransaction(cancelUrl, 'failure'), cancel: withTransaction(cancelUrl, 'cancel') },
        }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.checkoutId || !body.redirectUrl)
        throw new Error('Maya Checkout could not be created. Please try again.');
    return { providerReference: String(body.checkoutId), checkoutUrl: String(body.redirectUrl), rawMetadata: { checkoutId: body.checkoutId, requestReferenceNumber: input.transactionId } };
}
export async function verifyMayaPayment(reference) {
    const response = await fetch(`${mayaHost()}/payments/v1/payments/${encodeURIComponent(reference)}/status`, {
        headers: { Authorization: basicAuthorization() },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error('Maya payment verification is temporarily unavailable.');
        error.mayaDiagnostic = { httpStatus: response.status, providerCode: body?.code ?? null };
        throw error;
    }
    return normalizeMayaEvent(body);
}
function checkoutSession(attempt) {
    const createdAtValue = attempt.feeSnapshot?.checkoutCreatedAt;
    const expiresAtValue = attempt.feeSnapshot?.checkoutExpiresAt;
    const createdAt = typeof createdAtValue === 'string' ? new Date(createdAtValue) : null;
    const expiryBasis = createdAt ?? (attempt.updatedAt ? new Date(attempt.updatedAt) : null);
    const expiresAt = typeof expiresAtValue === 'string' ? new Date(expiresAtValue) : null;
    const reusableUntil = createdAt && !Number.isNaN(createdAt.getTime())
        ? new Date(Math.min(createdAt.getTime() + CHECKOUT_REUSE_WINDOW_MS, expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.getTime() : Number.POSITIVE_INFINITY))
        : null;
    return {
        checkoutUrl: typeof attempt.feeSnapshot?.checkoutUrl === 'string' ? attempt.feeSnapshot.checkoutUrl : null,
        expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
        reusable: Boolean(reusableUntil && reusableUntil.getTime() > Date.now()),
        expired: Boolean(expiryBasis && !Number.isNaN(expiryBasis.getTime()) && expiryBasis.getTime() + CHECKOUT_SESSION_LIFETIME_MS <= Date.now()),
    };
}
function result(attempt, additional = {}) {
    const session = checkoutSession(attempt);
    const checkoutReusable = additional.checkoutReusable === true && session.reusable;
    return {
        transactionId: attempt.id,
        poId: attempt.relatedId,
        transactionStatus: attempt.status,
        checkoutUrl: checkoutReusable ? session.checkoutUrl : null,
        checkoutReusable,
        checkoutExpiresAt: session.expiresAt?.toISOString() ?? null,
        amount: attempt.amount,
        reconciliationRequired: attempt.status === 'RECONCILIATION_REQUIRED',
        canRetry: TERMINAL_STATUSES.includes(attempt.status),
        message: attempt.status === 'RECONCILIATION_REQUIRED' ? 'Payment verification is pending.' : null,
        ...additional,
    };
}
async function calculatePaymentSnapshot(tx, po) {
    const now = new Date();
    const categoryIds = [...new Set(po.lineItems.map((line) => line.supplierItem.categoryId).filter(Boolean))];
    const units = [...new Set(po.lineItems.map((line) => line.supplierItem.unit).filter(Boolean))];
    const rules = await tx.feeRule.findMany({
        where: { appliesTo: 'PURCHASE_ORDER', isActive: true, deletedAt: null, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
    });
    const rule = rules.sort((left, right) => {
        const score = (candidate) => (candidate.category && categoryIds.includes(candidate.category) ? 2 : 0) + (candidate.unitType && units.includes(candidate.unitType) ? 2 : 0) - (candidate.category && !categoryIds.includes(candidate.category) ? 10 : 0) - (candidate.unitType && !units.includes(candidate.unitType) ? 10 : 0);
        return score(right) - score(left) || right.effectiveFrom.getTime() - left.effectiveFrom.getTime();
    })[0];
    const applicableQty = po.lineItems.filter((line) => !rule?.unitType || line.supplierItem.unit === rule.unitType).reduce((sum, line) => sum + line.qty, 0);
    const grossAmount = Number(po.totalAmount);
    const calculatedFee = !rule ? 0 : rule.rateType === 'PERCENTAGE' ? grossAmount * rule.rate : rule.rateType === 'PER_UNIT' ? applicableQty * rule.rate : rule.rate;
    const feeAmount = Math.round(calculatedFee * 100) / 100;
    return {
        grossAmount,
        feeAmount,
        netAmount: Math.round((grossAmount - feeAmount) * 100) / 100,
        rule,
        feeSnapshot: { ruleId: rule?.id ?? null, rateType: rule?.rateType ?? null, rate: rule?.rate ?? 0, basis: rule?.rateType === 'PER_UNIT' ? applicableQty : grossAmount, calculatedFee: feeAmount },
    };
}
export async function createRetailerMayaCheckout(ctx, poId) {
    const retailerOrgId = await requireRetailerOrganization(ctx);
    let attempt;
    let created = false;
    const outcome = await ctx.prisma.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT id FROM "PurchaseOrder" WHERE id = ${poId} FOR UPDATE`;
        const po = await tx.purchaseOrder.findFirst({
            where: { id: poId, buyerOrgId: retailerOrgId },
            include: { delivery: true, lineItems: { include: { supplierItem: { select: { categoryId: true, unit: true } } } } },
        });
        if (!po)
            throw new Error('Purchase order not found.');
        if (po.paymentStatus === 'PAID')
            throw new Error('This purchase order is already paid.');
        if (!isRetailerPurchaseOrderPaymentEligible(po)) {
            if (po.source === 'DIRECT_ORDER' && po.deliveryDateAgreementStatus !== 'AGREED')
                throw new Error('Agree on the delivery schedule with the Supplier before starting payment.');
            throw new Error('Supplier acceptance and a confirmed delivery address are required before payment.');
        }
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { paymentMethod: 'E_WALLET' } });
        const confirmed = await tx.paymentTransaction.findFirst({ where: { relatedType: 'PURCHASE_ORDER', relatedId: po.id, status: 'SUCCEEDED', deletedAt: null } });
        if (confirmed)
            throw new Error('This purchase order is already paid.');
        const active = await tx.paymentTransaction.findFirst({ where: { relatedType: 'PURCHASE_ORDER', relatedId: po.id, status: { in: OPEN_STATUSES }, deletedAt: null }, orderBy: { createdAt: 'desc' } });
        if (active)
            return { attempt: active, created: false, po };
        const lineSubtotal = po.lineItems.reduce((sum, line) => sum + Number(line.subtotal), 0);
        const expectedTotal = Math.round((lineSubtotal + Number(po.vatAmount) + Number(po.extraChargesTotal)) * 100) / 100;
        if (Math.abs(Number(po.totalAmount) - expectedTotal) > 0.009)
            throw new Error('This purchase order has an inconsistent commercial snapshot and cannot be paid.');
        const snapshot = await calculatePaymentSnapshot(tx, po);
        const createdAttempt = await tx.paymentTransaction.create({
            data: {
                id: randomUUID(),
                provider: 'PAYMAYA',
                environment: process.env.PAYMENT_ENV === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
                amount: snapshot.grossAmount,
                feeAmount: snapshot.feeAmount,
                providerFeeAmount: 0,
                netAmount: snapshot.netAmount,
                supplierOrgId: po.supplierOrgId,
                feeRuleId: snapshot.rule?.id ?? null,
                feeSnapshot: snapshot.feeSnapshot,
                status: 'AWAITING_PAYMENT',
                relatedType: 'PURCHASE_ORDER',
                relatedId: po.id,
                payerOrgId: retailerOrgId,
            },
        });
        return { attempt: createdAttempt, created: true, po };
    }, { isolationLevel: 'Serializable' });
    attempt = outcome.attempt;
    created = outcome.created;
    if (!created) {
        if (attempt.status === 'SUCCEEDED')
            return result(attempt);
        if (TERMINAL_STATUSES.includes(attempt.status))
            return result(attempt);
        if (attempt.status === 'RECONCILIATION_REQUIRED')
            return result(attempt, { reconciliationRequired: true, message: 'Payment verification is pending. A new checkout cannot be created until reconciliation is complete.' });
        if (attempt.gatewayReference) {
            const reconciled = await reconcileRetailerMayaPayment(ctx, attempt.id, true);
            if (reconciled.transactionStatus === 'SUCCEEDED' || reconciled.reconciliationRequired || reconciled.checkoutReusable)
                return reconciled;
            if (TERMINAL_STATUSES.includes(reconciled.transactionStatus))
                return createRetailerMayaCheckout(ctx, poId);
            return reconciled;
        }
        return result(attempt, { reconciliationRequired: true, message: 'The current payment attempt is still being prepared.' });
    }
    try {
        const checkout = await createMayaCheckout({ transactionId: attempt.id, poNumber: outcome.po.poNumber, amount: attempt.amount });
        const checkoutCreatedAt = new Date();
        const checkoutExpiresAt = new Date(checkoutCreatedAt.getTime() + CHECKOUT_SESSION_LIFETIME_MS);
        attempt = await ctx.prisma.paymentTransaction.update({
            where: { id: attempt.id },
            data: { gatewayReference: checkout.providerReference, status: 'PROCESSING', feeSnapshot: { ...(attempt.feeSnapshot ?? {}), checkoutUrl: checkout.checkoutUrl, checkoutCreatedAt: checkoutCreatedAt.toISOString(), checkoutExpiresAt: checkoutExpiresAt.toISOString(), checkoutApplication: 'KOMPRA_PORTAL', providerMetadata: checkout.rawMetadata } },
        });
        return result(attempt, { checkoutReusable: true });
    }
    catch (error) {
        await ctx.prisma.paymentTransaction.updateMany({ where: { id: attempt.id, status: 'AWAITING_PAYMENT' }, data: { status: 'FAILED' } });
        throw error;
    }
}
async function confirmVerifiedPayment(prisma, attempt, event) {
    if (attempt.status === 'SUCCEEDED')
        return attempt;
    if (attempt.provider !== 'PAYMAYA' || !attempt.gatewayReference || event.providerReference !== attempt.gatewayReference || event.status !== 'SUCCEEDED' || event.currency !== 'PHP' || Math.abs(event.amount - attempt.amount) > 0.009) {
        throw new Error('Verified Maya payment does not match the payment attempt.');
    }
    return prisma.$transaction(async (tx) => {
        const current = await tx.paymentTransaction.findUniqueOrThrow({ where: { id: attempt.id } });
        if (current.status === 'SUCCEEDED')
            return current;
        const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: current.relatedId } });
        const confirmed = await tx.paymentTransaction.update({
            where: { id: current.id },
            data: { status: 'SUCCEEDED', feeSnapshot: { ...(current.feeSnapshot ?? {}), providerEventId: event.eventId, providerVerifiedAt: event.occurredAt.toISOString() } },
        });
        await settleSuccessfulPayment(tx, confirmed.id);
        await tx.purchaseOrder.update({
            where: { id: po.id },
            data: { paymentStatus: 'PAID', paymentMethod: 'E_WALLET', paymentReference: event.providerReference, receiptSnapshot: { receiptId: `RCPT-${confirmed.id}`, paymentTransactionId: confirmed.id, poNumber: po.poNumber, provider: confirmed.provider, providerReference: event.providerReference, grossAmount: confirmed.amount, platformFee: confirmed.feeAmount, netAmount: confirmed.netAmount, confirmedAt: event.occurredAt.toISOString() } },
        });
        if (po.conversationId)
            await tx.conversationMessage.create({ data: { conversationId: po.conversationId, senderOrgId: po.buyerOrgId, type: 'PAYMENT_RECEIVED', message: 'Payment Confirmed', metadata: { event: 'PAYMENT_CONFIRMED', paymentTransactionId: confirmed.id, amount: confirmed.amount, provider: confirmed.provider } } });
        return confirmed;
    });
}
export async function reconcileRetailerMayaPayment(ctx, transactionId, allowReusableCheckout = false) {
    const retailerOrgId = await requireRetailerOrganization(ctx);
    const attempt = await ctx.prisma.paymentTransaction.findFirst({ where: { id: transactionId, payerOrgId: retailerOrgId, relatedType: 'PURCHASE_ORDER', deletedAt: null } });
    if (!attempt)
        throw new Error('Payment attempt not found.');
    if (attempt.status === 'SUCCEEDED' || TERMINAL_STATUSES.includes(attempt.status))
        return result(attempt);
    if (!attempt.gatewayReference)
        return result(attempt, { reconciliationRequired: true, message: 'Payment verification is pending.' });
    let observedProviderSuccess = false;
    try {
        const verified = await verifyMayaPayment(attempt.gatewayReference);
        if (verified.status === 'SUCCEEDED') {
            observedProviderSuccess = true;
            return result(await confirmVerifiedPayment(ctx.prisma, attempt, verified));
        }
        if (TERMINAL_STATUSES.includes(verified.status)) {
            await ctx.prisma.paymentTransaction.updateMany({ where: { id: attempt.id, status: { in: OPEN_STATUSES } }, data: { status: verified.status } });
            return result(await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: attempt.id } }));
        }
        const session = checkoutSession(attempt);
        if (allowReusableCheckout && session.reusable)
            return result(attempt, { checkoutReusable: true });
        if (session.expired) {
            await ctx.prisma.$transaction(async (tx) => {
                await tx.$queryRaw `SELECT id FROM "PurchaseOrder" WHERE id = ${attempt.relatedId} FOR UPDATE`;
                const succeeded = await tx.paymentTransaction.findFirst({ where: { relatedType: 'PURCHASE_ORDER', relatedId: attempt.relatedId, status: 'SUCCEEDED', deletedAt: null } });
                if (succeeded)
                    return;
                await tx.paymentTransaction.updateMany({
                    where: { id: attempt.id, status: { in: ['PENDING', 'AWAITING_PAYMENT', 'PROCESSING'] } },
                    data: { status: 'EXPIRED', feeSnapshot: { ...(attempt.feeSnapshot ?? {}), checkoutSupersededAt: new Date().toISOString(), checkoutTerminalSource: 'INTERNAL_PROVIDER_TTL' } },
                });
            }, { isolationLevel: 'Serializable' });
            const succeeded = await ctx.prisma.paymentTransaction.findFirst({ where: { relatedType: 'PURCHASE_ORDER', relatedId: attempt.relatedId, status: 'SUCCEEDED', deletedAt: null } });
            if (succeeded)
                return result(succeeded);
            return result(await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: attempt.id } }), { message: 'The previous checkout expired. Retry payment to create a new checkout.' });
        }
        return result(attempt, { message: session.reusable ? 'Maya still reports this payment as pending.' : 'This checkout is near expiry and is not reusable. Retry after its one-hour session lifetime ends.' });
    }
    catch (error) {
        if (observedProviderSuccess) {
            await ctx.prisma.paymentTransaction.updateMany({ where: { id: attempt.id, status: { in: ['PENDING', 'AWAITING_PAYMENT', 'PROCESSING'] } }, data: { status: 'RECONCILIATION_REQUIRED' } });
            return result(await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: attempt.id } }), { reconciliationRequired: true, message: 'Maya reported a completed payment that requires reconciliation.' });
        }
        const session = checkoutSession(attempt);
        if (session.expired) {
            await ctx.prisma.$transaction(async (tx) => {
                await tx.$queryRaw `SELECT id FROM "PurchaseOrder" WHERE id = ${attempt.relatedId} FOR UPDATE`;
                const succeeded = await tx.paymentTransaction.findFirst({ where: { relatedType: 'PURCHASE_ORDER', relatedId: attempt.relatedId, status: 'SUCCEEDED', deletedAt: null } });
                if (!succeeded)
                    await tx.paymentTransaction.updateMany({ where: { id: attempt.id, status: { in: ['PENDING', 'AWAITING_PAYMENT', 'PROCESSING'] } }, data: { status: 'EXPIRED', feeSnapshot: { ...(attempt.feeSnapshot ?? {}), checkoutSupersededAt: new Date().toISOString(), checkoutTerminalSource: 'INTERNAL_PROVIDER_TTL', verificationUnavailable: true } } });
            }, { isolationLevel: 'Serializable' });
            const succeeded = await ctx.prisma.paymentTransaction.findFirst({ where: { relatedType: 'PURCHASE_ORDER', relatedId: attempt.relatedId, status: 'SUCCEEDED', deletedAt: null } });
            if (succeeded)
                return result(succeeded);
            return result(await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: attempt.id } }), { message: 'The previous checkout is no longer safely reusable. Retry payment to create a new checkout.' });
        }
        return result(attempt, { reconciliationRequired: true, message: 'Maya verification is temporarily unavailable. No new checkout was created.' });
    }
}
export async function getRetailerPaymentAttempt(ctx, transactionId) {
    const retailerOrgId = await requireRetailerOrganization(ctx);
    const attempt = await ctx.prisma.paymentTransaction.findFirst({ where: { id: transactionId, payerOrgId: retailerOrgId, relatedType: 'PURCHASE_ORDER', deletedAt: null } });
    if (!attempt)
        throw new Error('Payment attempt not found.');
    return result(attempt);
}
export async function processMayaWebhook(prisma, payload) {
    const event = normalizeMayaEvent(payload);
    const rawWebhookStatus = String(payload.paymentStatus ?? payload.status ?? '').toUpperCase();
    const attempt = event.requestReferenceNumber
        ? await prisma.paymentTransaction.findFirst({ where: { id: event.requestReferenceNumber, provider: 'PAYMAYA', deletedAt: null } })
        : await prisma.paymentTransaction.findFirst({ where: { gatewayReference: event.providerReference, provider: 'PAYMAYA', deletedAt: null } });
    if (!attempt)
        return { received: true, ignored: true };
    if (attempt.status === 'SUCCEEDED')
        return { received: true, idempotent: true };
    if (TERMINAL_STATUSES.includes(attempt.status)) {
        if (event.status === 'SUCCEEDED' && attempt.status === 'EXPIRED' && attempt.feeSnapshot?.checkoutTerminalSource === 'INTERNAL_PROVIDER_TTL') {
            const lateEvidenceMatches = event.requestReferenceNumber === attempt.id
                && Boolean(attempt.gatewayReference)
                && event.providerReference === attempt.gatewayReference
                && event.currency === 'PHP'
                && Math.abs(event.amount - attempt.amount) <= 0.009;
            if (!lateEvidenceMatches)
                throw new Error('Maya webhook evidence does not match the expired payment attempt.');
            await prisma.paymentTransaction.updateMany({ where: { id: attempt.id, status: 'EXPIRED' }, data: { status: 'RECONCILIATION_REQUIRED', feeSnapshot: { ...(attempt.feeSnapshot ?? {}), lateSuccessEvidence: { eventId: event.eventId, receivedAt: event.occurredAt.toISOString(), amount: event.amount, currency: event.currency } } } });
            return { received: true, reconciliationRequired: true };
        }
        return { received: true, idempotent: true, terminal: attempt.status };
    }
    if (!attempt.gatewayReference || attempt.gatewayReference !== event.providerReference)
        throw new Error('Maya webhook reference mismatch.');
    if (TERMINAL_STATUSES.includes(event.status)) {
        await prisma.paymentTransaction.updateMany({ where: { id: attempt.id, status: { in: OPEN_STATUSES } }, data: { status: event.status } });
        return { received: true, terminal: event.status };
    }
    if (event.status !== 'SUCCEEDED')
        return { received: true };
    const evidenceMatches = event.requestReferenceNumber === attempt.id && event.currency === 'PHP' && Math.abs(event.amount - attempt.amount) <= 0.009;
    if (!evidenceMatches)
        throw new Error('Maya webhook evidence does not match the payment attempt.');
    const sandboxWebhookEvidence = attempt.environment === 'SANDBOX' ? {
        status: rawWebhookStatus,
        isPaid: payload.isPaid === true,
        requestReferenceNumber: event.requestReferenceNumber,
        providerReference: event.providerReference,
        amount: event.amount,
        currency: event.currency,
        receivedAt: event.occurredAt.toISOString(),
    } : undefined;
    await prisma.paymentTransaction.updateMany({
        where: { id: attempt.id, status: { in: OPEN_STATUSES } },
        data: { status: 'RECONCILIATION_REQUIRED', feeSnapshot: { ...(attempt.feeSnapshot ?? {}), providerEventId: event.eventId, webhookEvidence: { eventId: event.eventId, receivedAt: event.occurredAt.toISOString(), status: event.status, amount: event.amount, currency: event.currency }, ...(sandboxWebhookEvidence ? { sandboxWebhookEvidence } : {}) } },
    });
    try {
        const verified = await verifyMayaPayment(attempt.gatewayReference);
        await confirmVerifiedPayment(prisma, attempt, verified);
        return { received: true, confirmed: true };
    }
    catch (error) {
        const diagnostic = error?.mayaDiagnostic;
        if (attempt.environment === 'SANDBOX' && rawWebhookStatus === 'PAYMENT_SUCCESS' && payload.isPaid === true && diagnostic?.providerCode === 'K007') {
            const current = await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: attempt.id } });
            await prisma.paymentTransaction.updateMany({
                where: { id: attempt.id, status: 'RECONCILIATION_REQUIRED' },
                data: { feeSnapshot: { ...(current.feeSnapshot ?? {}), reconciliationRequiredAt: new Date().toISOString(), providerVerification: { result: 'UNAVAILABLE', providerCode: diagnostic.providerCode, httpStatus: diagnostic.httpStatus ?? null } } },
            });
            return { received: true, reconciliationRequired: true };
        }
        throw error;
    }
}
export function assertMayaWebhookSource(remoteAddress) {
    if (process.env.NODE_ENV !== 'production')
        return;
    const configured = process.env.MAYA_WEBHOOK_ALLOWED_IPS?.split(',').map((value) => value.trim()).filter(Boolean);
    const allowed = configured?.length ? configured : ['18.138.50.235', '3.1.207.200'];
    const normalized = String(remoteAddress ?? '').replace(/^::ffff:/, '');
    if (!allowed.includes(normalized))
        throw new Error('Untrusted Maya webhook source.');
}
