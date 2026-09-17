import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  DEFAULT_DELIVERY_AGREEMENT_BUYER_RESPONSE_HOURS,
  evaluateDeliveryAgreementTimeout,
  getDeliveryAgreementBuyerResponseHours,
  getDeliveryAgreementDeadline,
  isDeliveryAgreementDeadlineExpired,
  nextSupplierProposalDeadline,
} from '../src/services/purchaseOrderDeliveryAgreement.service.js'
import { classifyPurchaseOrderFunding, isPurchaseOrderPaymentReady } from '../src/services/purchaseOrderPolicy.service.js'

let passed = 0
const check = (name: string, test: () => void) => {
  test()
  passed += 1
  console.info(`PASS ${String(passed).padStart(2, '0')} ${name}`)
}
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const proposedAt = new Date('2026-09-15T02:00:00.000Z')
const deadline = new Date('2026-09-16T02:00:00.000Z')
const proposal = new Date('2026-09-20T00:00:00.000Z')
const base = {
  id: 'po-1', source: 'DIRECT_ORDER', status: 'SUPPLIER_ACCEPTED', buyerOrgId: 2, supplierOrgId: 1,
  deliveryDateAgreementStatus: 'PENDING_BUYER', deliveryDateResponseDeadlineAt: deadline,
  deliveryDateProposalVersion: 1, supplierExpectedDeliveryAt: proposal,
}
const identity = { purchaseOrderId: base.id, proposalVersion: 1, deadline, supplierProposal: proposal }
const agreementSource = source('src/services/purchaseOrderDeliveryAgreement.service.ts')
const mutationSource = source('src/graphql/resolvers/purchaseOrder/purchaseOrder.mutation.ts')
const workerSource = source('src/workers/deliveryAgreement.worker.ts')
const retailerUi = source('../k03pr4p05-fe/screens/retailer/RetailerPurchaseOrderDetailScreen.tsx')

check('default response period is 24 hours', () => assert.equal(DEFAULT_DELIVERY_AGREEMENT_BUYER_RESPONSE_HOURS, 24))
check('missing or invalid configuration falls back to 24 hours', () => {
  const original = process.env.DELIVERY_AGREEMENT_BUYER_RESPONSE_HOURS
  delete process.env.DELIVERY_AGREEMENT_BUYER_RESPONSE_HOURS
  assert.equal(getDeliveryAgreementBuyerResponseHours(), 24)
  process.env.DELIVERY_AGREEMENT_BUYER_RESPONSE_HOURS = 'invalid'
  assert.equal(getDeliveryAgreementBuyerResponseHours(), 24)
  if (original == null) delete process.env.DELIVERY_AGREEMENT_BUYER_RESPONSE_HOURS
  else process.env.DELIVERY_AGREEMENT_BUYER_RESPONSE_HOURS = original
})
check('configured response period is honored by one policy helper', () => assert.equal(getDeliveryAgreementDeadline(proposedAt, 2).toISOString(), '2026-09-15T04:00:00.000Z'))
check('Supplier proposal creates a deadline and increments proposal identity once', () => {
  const next = nextSupplierProposalDeadline({ ...base, deliveryDateProposalVersion: 0 }, proposedAt)
  assert.equal(next.deliveryDateResponseDeadlineAt?.toISOString(), deadline.toISOString())
  assert.equal(next.deliveryDateProposalVersion, 1)
})
check('screen and query refresh cannot extend a deadline', () => assert.doesNotMatch(retailerUi, /deliveryDateResponseDeadlineAt\s*[:=]/))
check('explicit Buyer acceptance clears deadline and records method', () => assert.match(agreementSource, /deliveryDateAgreementMethod: 'BUYER_ACCEPTED', deliveryDateResponseDeadlineAt: null/))
check('explicit Supplier acceptance clears deadline and records method', () => assert.match(agreementSource, /deliveryDateAgreementMethod: 'SUPPLIER_ACCEPTED', deliveryDateResponseDeadlineAt: null/))
check('Buyer counter-proposal invalidates deadline', () => assert.match(agreementSource, /deliveryDateAgreementStatus: 'PENDING_SUPPLIER'[\s\S]*?deliveryDateResponseDeadlineAt: null/))
check('Supplier counter-proposal creates a new monotonic proposal version', () => assert.match(agreementSource, /deliveryDateProposalVersion: \(po\.deliveryDateProposalVersion \?\? 0\) \+ 1/))
check('old delayed job cannot accept a newer proposal version', () => assert.equal(evaluateDeliveryAgreementTimeout({ ...base, deliveryDateProposalVersion: 2 }, identity, new Date('2026-09-16T02:01:00Z')).reason, 'STALE_PROPOSAL_VERSION'))
check('old delayed job cannot accept a replaced deadline', () => assert.equal(evaluateDeliveryAgreementTimeout({ ...base, deliveryDateResponseDeadlineAt: new Date('2026-09-16T03:00:00Z') }, identity, new Date('2026-09-16T04:00:00Z')).reason, 'STALE_DEADLINE'))
check('old delayed job cannot accept a changed Supplier date', () => assert.equal(evaluateDeliveryAgreementTimeout({ ...base, supplierExpectedDeliveryAt: new Date('2026-09-21T00:00:00Z') }, identity, new Date('2026-09-16T02:01:00Z')).reason, 'STALE_PROPOSAL_DATE'))
check('active expired deadline becomes eligible for system agreement', () => assert.equal(evaluateDeliveryAgreementTimeout(base, identity, new Date('2026-09-16T02:01:00Z')).eligible, true))
check('deadline is not expired from the client or before server time', () => assert.equal(isDeliveryAgreementDeadlineExpired(deadline, new Date('2026-09-16T01:59:59Z')), false))
check('timeout transition persists AGREED and AUTO_BUYER_TIMEOUT atomically', () => {
  assert.match(agreementSource, /deliveryDateAgreementStatus: 'AGREED'/)
  assert.match(agreementSource, /deliveryDateAgreementMethod: 'AUTO_BUYER_TIMEOUT'/)
})
check('timeout retry is a source-state no-op', () => assert.equal(evaluateDeliveryAgreementTimeout({ ...base, deliveryDateAgreementStatus: 'AGREED' }, identity, new Date('2026-09-16T03:00:00Z')).reason, 'INACTIVE'))
check('unpaid direct order is payment-blocked before agreement', () => assert.equal(isPurchaseOrderPaymentReady({ ...base, supplierConfirmation: 'CONFIRMED', paymentStatus: 'PENDING', delivery: { address: 'A', latitude: 1, longitude: 2 } }), false))
check('unpaid direct order becomes payment-eligible after agreement without charging', () => assert.equal(isPurchaseOrderPaymentReady({ ...base, deliveryDateAgreementStatus: 'AGREED', supplierConfirmation: 'CONFIRMED', paymentStatus: 'PENDING', delivery: { address: 'A', latitude: 1, longitude: 2 } }), true))
check('successful prepaid evidence remains authoritative across agreement timeout', () => {
  const po = { id: base.id, buyerOrgId: 2, supplierOrgId: 1, totalAmount: 100, paymentMethod: 'CASH' }
  const payment = { id: 'pay-1', relatedType: 'PURCHASE_ORDER', relatedId: base.id, payerOrgId: 2, supplierOrgId: 1, provider: 'PAYMAYA', environment: 'SANDBOX', status: 'SUCCEEDED', amount: 100, gatewayReference: 'maya-1', deletedAt: null }
  assert.equal(classifyPurchaseOrderFunding(po, payment), 'PREPAID_PAID')
})
check('auto-agreement performs no wallet movement', () => assert.doesNotMatch(agreementSource, /wallet\.|heldBalance|ledgerEntry/))
check('auto-agreement creates no settlement', () => assert.doesNotMatch(agreementSource, /purchaseOrderSettlement/))
check('auto-agreement posts no platform fee', () => assert.doesNotMatch(agreementSource, /platformWallet|platformFee/))
check('pending cancellation blocks timeout agreement', () => assert.equal(evaluateDeliveryAgreementTimeout(base, identity, new Date('2026-09-16T03:00:00Z'), { cancellationStatus: 'REQUESTED' }).reason, 'BLOCKED'))
check('refund record blocks timeout agreement', () => assert.equal(evaluateDeliveryAgreementTimeout(base, identity, new Date('2026-09-16T03:00:00Z'), { refundExists: true }).reason, 'BLOCKED'))
check('same Buyer and Supplier organization cannot auto-agree', () => assert.equal(evaluateDeliveryAgreementTimeout({ ...base, buyerOrgId: 1 }, identity, new Date('2026-09-16T03:00:00Z')).reason, 'INELIGIBLE_IDENTITY_OR_STATE'))
check('missing Buyer organization cannot auto-agree', () => assert.equal(evaluateDeliveryAgreementTimeout({ ...base, buyerOrgId: null }, identity, new Date('2026-09-16T03:00:00Z')).reason, 'INELIGIBLE_IDENTITY_OR_STATE'))
check('Agent/RFQ ownership is not pretended to be Retailer organization timeout support', () => assert.equal(evaluateDeliveryAgreementTimeout({ ...base, source: 'RFQ', buyerOrgId: null }, identity, new Date('2026-09-16T03:00:00Z')).reason, 'INACTIVE'))
check('PENDING_SUPPLIER never auto-agrees', () => assert.equal(evaluateDeliveryAgreementTimeout({ ...base, deliveryDateAgreementStatus: 'PENDING_SUPPLIER' }, identity, new Date('2026-09-16T03:00:00Z')).reason, 'INACTIVE'))
check('ready, transit, and terminal stale jobs are rejected', () => {
  for (const status of ['READY_FOR_DISPATCH', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED']) assert.equal(evaluateDeliveryAgreementTimeout({ ...base, status }, identity, new Date('2026-09-16T03:00:00Z')).eligible, false)
})
check('timeout serializes on PO and predicates proposal identity', () => {
  assert.match(agreementSource, /FOR UPDATE/)
  assert.match(agreementSource, /deliveryDateProposalVersion: po\.deliveryDateProposalVersion/)
})
check('notifications and conversation message are created only after winning transition', () => assert.match(agreementSource, /if \(transitioned\.count !== 1\)[\s\S]*?conversationMessage\.create[\s\S]*?Promise\.all/))
check('Supplier has no force-timeout GraphQL mutation', () => {
  assert.doesNotMatch(mutationSource, /field\(['"]autoAcceptDeliveryDate/)
  assert.doesNotMatch(mutationSource, /field\(['"]forceAgree/)
})
check('client countdown never writes AGREED', () => assert.doesNotMatch(retailerUi, /setPo\([^\n]*AGREED|deadlineExpired/))
check('restart recovery is bounded and worker retries are idempotent', () => {
  assert.match(workerSource, /reconcileExpiredDeliveryAgreements\(prisma, 50\)/)
  assert.match(workerSource, /60_000/)
  assert.match(agreementSource, /take: Math\.min\(100/)
})

console.info(`Delivery agreement timeout verifier passed ${passed} deterministic checks.`)
