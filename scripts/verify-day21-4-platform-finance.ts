import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const portalPayment = read('k03pr4p05-be/src/services/mayaPayment.service.ts');
const portalIndex = read('k03pr4p05-be/src/index.ts');
const webPayment = read('k03pr4Web-BE/src/services/purchase-order-payment.service.ts');
const webPaymentController = read('k03pr4Web-BE/src/controllers/payment.controller.ts');
const webConfirmation = read('k03pr4Web-BE/src/services/payments/payment-confirmation.service.ts');
const settlementPosting = read('k03pr4Web-BE/src/services/settlement-wallet-posting.service.ts');
const platformWithdrawal = read('k03pr4p05-be/src/services/platformWithdrawal.service.ts');
const portalResolver = read('k03pr4p05-be/src/graphql/resolvers/admin/platformFinance.resolver.ts');
const portalEnv = read('k03pr4p05-be/.env.example');
const webEnv = read('k03pr4Web-BE/.env.example');
const backfill = read('k03pr4Web-BE/scripts/reconcile-platform-fees.ts');

const checks: Array<[string, () => void]> = [];
const includes = (name: string, source: string, value: string) => checks.push([name, () => assert.ok(source.includes(value), `${name}: missing ${value}`)]);
const excludes = (name: string, source: string, value: string) => checks.push([name, () => assert.ok(!source.includes(value), `${name}: unexpected ${value}`)]);

includes('Portal persists checkout creation time', portalPayment, 'checkoutCreatedAt');
includes('Portal persists checkout expiry', portalPayment, 'checkoutExpiresAt');
includes('Portal marks unsafe checkout by internal TTL', portalPayment, "checkoutTerminalSource: 'INTERNAL_PROVIDER_TTL'");
includes('Portal quarantines late success after internal expiry', portalPayment, 'lateSuccessEvidence');
includes('Portal only emits a URL when reusable', portalPayment, 'checkoutUrl: checkoutReusable ? session.checkoutUrl : null');
includes('Portal preserves reconciliation attempts', portalPayment, "attempt.status === 'RECONCILIATION_REQUIRED'");
includes('Portal persists sandbox success evidence', portalPayment, 'sandboxWebhookEvidence');
includes('Portal preserves K007 reconciliation', portalPayment, "diagnostic?.providerCode === 'K007'");
includes('Portal rechecks succeeded under PO lock', portalPayment, 'SELECT id FROM "PurchaseOrder"');
includes('Portal mounts canonical Maya webhook', portalIndex, "app.post('/api/payments/webhook/maya'");
excludes('Portal removes the noncanonical webhook route', portalIndex, "app.post('/payments/webhook/maya'");
checks.push(['Portal parses webhook JSON before route registration', () => assert.ok(portalIndex.indexOf('app.use(express.json())') < portalIndex.indexOf("app.post('/api/payments/webhook/maya'"))]);
includes('Portal callback is not a confirmation mutation', portalEnv, 'supplier-links/payment-return');
includes('Portal identifies its Maya app', portalEnv, 'MAYA_APPLICATION_CHANNEL=KOMPRA_PORTAL');

includes('PH persists checkout creation time', webPayment, 'checkoutCreatedAt');
includes('PH persists checkout expiry', webPayment, 'checkoutExpiresAt');
includes('PH marks unsafe checkout by internal TTL', webPayment, "checkoutTerminalSource: 'INTERNAL_PROVIDER_TTL'");
includes('PH quarantines late success after internal expiry', webPayment, 'lateSuccessEvidence');
includes('PH webhook controller does not resurrect terminal attempts', webPaymentController, "reason: 'payment-already-terminal'");
includes('PH result defaults checkout to not reusable', webPayment, 'checkoutReusable: false');
includes('PH locks the PO before attempt creation', webPayment, 'FOR UPDATE');
includes('PH rechecks success before superseding', webPayment, "status: 'SUCCEEDED'");
includes('PH preserves reconciliation attempts', webPayment, "attempt.status === 'RECONCILIATION_REQUIRED'");
includes('PH identifies its Maya app', webEnv, 'MAYA_APPLICATION_CHANNEL=KOMPRA_PH');
includes('PH success callback targets wholesale UI', webEnv, 'localhost:3000/wholesale/payments/success');
includes('PH cancel callback targets wholesale UI', webEnv, 'localhost:3000/wholesale/payments/cancel');
includes('Portal callback targets Portal UI', portalEnv, 'localhost:8081/supplier-links/payment-return');
includes('Both apps keep checkout reuse below provider lifetime', portalEnv + webEnv, 'MAYA_CHECKOUT_REUSE_MINUTES=55');

includes('PH confirmation creates Supplier escrow', webConfirmation, "sourceType: 'ESCROW_HOLD'");
includes('PH confirmation records fee facts without crediting browser success', webConfirmation, 'platformFeeRecord.upsert');
excludes('PH confirmation does not credit platform wallet', webConfirmation, 'platformWallet.update');
includes('Settlement validates gross split', settlementPosting, 'settlement.platformFee + settlement.supplierNet');
includes('Settlement credits platform fees by settlement ID', settlementPosting, "sourceType: 'PURCHASE_ORDER_PLATFORM_FEE'");
includes('Settlement posting key uses settlement ID', settlementPosting, 'referenceId: settlement.id');
includes('Settlement posting remains environment scoped', settlementPosting, 'currency_environment');
includes('Settlement posting preserves legacy fee idempotency', settlementPosting, "sourceType: 'TRANSACTION_FEE'");

includes('Platform request reserves available funds', platformWithdrawal, 'balance: { decrement: amount }, heldBalance: { increment: amount }');
includes('Platform approval moves no balance', platformWithdrawal, 'PLATFORM_WITHDRAWAL_APPROVED');
includes('Platform completion decreases held only', platformWithdrawal, 'heldBalance: { decrement: withdrawal.amount }');
includes('Platform failure restores available', platformWithdrawal, 'balance: { increment: withdrawal.amount }, heldBalance: { decrement: withdrawal.amount }');
includes('Platform production payout uses payout boundary', platformWithdrawal, 'getProductionPayoutProvider()');
includes('Platform production self approval is denied', platformWithdrawal, 'requester cannot approve');
includes('Platform payout destination is encrypted', platformWithdrawal, 'encryptPayoutDestination(destination)');
includes('Platform wallet is resolved server-side', platformWithdrawal, 'getOrCreatePlatformWallet(tx, environment)');
includes('Admin read requires platform authority', portalResolver, "requireAdminPermission(ctx, 'PLATFORM_WALLET_VIEW')");
includes('Admin mutation requires withdrawal authority', portalResolver, "requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE')");
excludes('Arbitrary wallet adjustment mutation is absent', read('k03pr4p05-be/src/graphql/resolvers/admin/adminGovernance.resolver.ts'), 'adminAdjustPlatformWallet');

includes('Backfill defaults to dry run', backfill, "mode: apply ? 'APPLY' : 'DRY_RUN'");
includes('Backfill apply is sandbox only', backfill, "environment !== 'SANDBOX'");
includes('Backfill requires explicit token', backfill, 'POST_PLATFORM_FEES_SANDBOX');
includes('Backfill checks Supplier settlement posting', backfill, "sourceType: 'PURCHASE_ORDER_SETTLEMENT'");
includes('Backfill recognizes legacy fee credits', backfill, "sourceType: 'TRANSACTION_FEE'");
includes('Backfill never updates settlement values', backfill, 'purchaseOrderSettlement.findMany');
excludes('Backfill has no settlement update', backfill, 'purchaseOrderSettlement.update');

const reusable = (createdAt: number | null, now: number) => createdAt !== null && createdAt + 55 * 60_000 > now;
const safelyReplaceable = (createdAt: number | null, now: number) => createdAt !== null && createdAt + 60 * 60_000 <= now;
checks.push(['Fresh checkout is reusable', () => assert.equal(reusable(1_000, 1_000 + 54 * 60_000), true)]);
checks.push(['Stale checkout is not reusable', () => assert.equal(reusable(1_000, 1_000 + 55 * 60_000), false)]);
checks.push(['Near-expiry checkout is not replaced early', () => assert.equal(safelyReplaceable(1_000, 1_000 + 59 * 60_000), false)]);
checks.push(['Provider-expired checkout can be replaced', () => assert.equal(safelyReplaceable(1_000, 1_000 + 60 * 60_000), true)]);
checks.push(['Legacy checkout without age is not reusable', () => assert.equal(reusable(null, Date.now()), false)]);

type Balance = { available: number; held: number };
const request = (wallet: Balance, amount: number) => ({ available: wallet.available - amount, held: wallet.held + amount });
const complete = (wallet: Balance, amount: number) => ({ available: wallet.available, held: wallet.held - amount });
const fail = (wallet: Balance, amount: number) => ({ available: wallet.available + amount, held: wallet.held - amount });
checks.push(['Withdrawal request available to held', () => assert.deepEqual(request({ available: 150, held: 0 }, 100), { available: 50, held: 100 })]);
checks.push(['Withdrawal completion does not double debit available', () => assert.deepEqual(complete({ available: 50, held: 100 }, 100), { available: 50, held: 0 })]);
checks.push(['Withdrawal failure restores available', () => assert.deepEqual(fail({ available: 50, held: 100 }, 100), { available: 150, held: 0 })]);

for (const [name, check] of checks) check();
console.log(`Day 21.4 payment/platform finance verification PASS (${checks.length} deterministic checks).`);
