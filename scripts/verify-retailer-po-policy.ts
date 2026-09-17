import assert from 'node:assert/strict';

import {
  DEFAULT_COD_MAX_ORDER_AMOUNT_PHP,
  hasConfirmedDeliveryLocation,
  isCodAmountEligible,
  isPurchaseOrderFundingSatisfied,
  isPurchaseOrderPaymentReady,
  toCentavos,
} from '../src/services/purchaseOrderPolicy.service.js';

assert.equal(DEFAULT_COD_MAX_ORDER_AMOUNT_PHP, 25_000);
assert.equal(toCentavos(24_999.99), 2_499_999);
assert.equal(toCentavos(25_000), 2_500_000);
assert.equal(toCentavos(25_000.01), 2_500_001);
assert.equal(isCodAmountEligible(24_999.99), true);
assert.equal(isCodAmountEligible(25_000), true);
assert.equal(isCodAmountEligible(25_000.01), false);
assert.equal(isCodAmountEligible(61_500), false);

const delivery = { address: '123 Test Street, Manila', latitude: 14.5995, longitude: 120.9842 };
assert.equal(hasConfirmedDeliveryLocation(delivery), true);
assert.equal(hasConfirmedDeliveryLocation({ ...delivery, address: '  ' }), false);
assert.equal(hasConfirmedDeliveryLocation({ ...delivery, latitude: null }), false);

const accepted = { id: 'po-policy-1', source: 'RFQ_ORDER', status: 'SUPPLIER_ACCEPTED', supplierConfirmation: 'CONFIRMED', paymentStatus: 'PENDING', delivery, buyerOrgId: 2, supplierOrgId: 1 };
assert.equal(isPurchaseOrderPaymentReady(accepted), true);
assert.equal(isPurchaseOrderPaymentReady({ ...accepted, supplierConfirmation: 'REVIEW_REQUIRED' }), false);
assert.equal(isPurchaseOrderPaymentReady({ ...accepted, delivery: null }), false);
assert.equal(isPurchaseOrderPaymentReady({ ...accepted, source: 'DIRECT_ORDER', deliveryDateAgreementStatus: 'PENDING_BUYER' }), false);
assert.equal(isPurchaseOrderPaymentReady({ ...accepted, source: 'DIRECT_ORDER', deliveryDateAgreementStatus: 'AGREED' }), true);

assert.equal(isPurchaseOrderFundingSatisfied({ ...accepted, totalAmount: 25_000, paymentMethod: 'CASH' }), true);
assert.equal(isPurchaseOrderFundingSatisfied({ ...accepted, totalAmount: 25_000.01, paymentMethod: 'CASH' }), false);
const successfulMayaPayment = {
  id: 'payment-policy-1',
  relatedType: 'PURCHASE_ORDER',
  relatedId: accepted.id,
  payerOrgId: accepted.buyerOrgId,
  supplierOrgId: accepted.supplierOrgId,
  provider: 'PAYMAYA',
  environment: 'SANDBOX',
  status: 'SUCCEEDED',
  amount: 61_500,
  gatewayReference: 'maya-policy-reference',
  deletedAt: null,
};
assert.equal(isPurchaseOrderFundingSatisfied({ ...accepted, totalAmount: 61_500, paymentMethod: 'E_WALLET' }, successfulMayaPayment), true);
assert.equal(isPurchaseOrderFundingSatisfied({ ...accepted, totalAmount: 61_500, paymentMethod: 'E_WALLET' }, { ...successfulMayaPayment, status: 'PENDING' }), false);

console.log('Retailer PO delivery/payment policy verifier passed.');
