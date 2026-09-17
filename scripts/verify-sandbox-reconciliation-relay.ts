import assert from 'node:assert/strict';
import {
  confirmSandboxPaymentThroughSettlementService,
  SettlementRelayError,
  type SettlementRelayErrorCode,
} from '../src/services/sandboxSettlementRelay.service.js';

const transactionId = 'sandbox-payment-verifier';
const serviceKey = 'verifier-secret-never-print';
const baseInput = {
  baseUrl: 'http://localhost:8000/api',
  serviceKey,
  paymentTransactionId: transactionId,
  reason: 'Deterministic sandbox reconciliation relay verification.',
  actorUserId: 1,
  actorOrgId: 1,
};

let checks = 0;
async function expectsCode(code: SettlementRelayErrorCode, fetchImpl: typeof fetch, timeoutMs = 100) {
  await assert.rejects(
    confirmSandboxPaymentThroughSettlementService({ ...baseInput, fetchImpl, timeoutMs }),
    (error: unknown) => {
      assert(error instanceof SettlementRelayError);
      assert.equal(error.extensions.code, code);
      assert(!error.message.includes(serviceKey));
      checks += 1;
      return true;
    },
  );
}

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

await expectsCode(
  'SETTLEMENT_SERVICE_UNAVAILABLE',
  (async () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8000'), { code: 'ECONNREFUSED' });
    throw Object.assign(new TypeError('fetch failed'), { cause });
  }) as typeof fetch,
);

await expectsCode(
  'SETTLEMENT_SERVICE_TIMEOUT',
  ((_url: URL | RequestInfo, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
  })) as typeof fetch,
  5,
);

await expectsCode('SETTLEMENT_SERVICE_AUTH_REJECTED', (async () => jsonResponse(401, { message: 'Unauthorized' })) as typeof fetch);
await expectsCode('SETTLEMENT_SERVICE_AUTH_REJECTED', (async () => jsonResponse(403, { message: 'Forbidden' })) as typeof fetch);
await expectsCode('SETTLEMENT_CONFIRMATION_FAILED', (async () => jsonResponse(500, { message: 'Internal error' })) as typeof fetch);
await expectsCode('SETTLEMENT_SERVICE_REJECTED', (async () => jsonResponse(400, { message: 'Evidence mismatch' })) as typeof fetch);
await expectsCode('SETTLEMENT_SERVICE_PROTOCOL_ERROR', (async () => new Response('not-json', { status: 200 })) as typeof fetch);

let canonicalConfirmationCount = 0;
const idempotentDownstream = (async (url: URL | RequestInfo, init?: RequestInit) => {
  assert.equal(String(url), `http://localhost:8000/api/payments/admin/sandbox-reconciliation/${transactionId}/confirm`);
  assert.equal(init?.method, 'POST');
  assert.equal((init?.headers as Record<string, string>)['x-sandbox-settlement-key'], serviceKey);
  const body = JSON.parse(String(init?.body));
  assert.deepEqual(body, {
    reason: baseInput.reason,
    actorUserId: baseInput.actorUserId,
    actorOrgId: baseInput.actorOrgId,
  });
  const alreadyConfirmed = canonicalConfirmationCount > 0;
  if (!alreadyConfirmed) canonicalConfirmationCount += 1;
  return jsonResponse(200, {
    success: true,
    data: { id: transactionId, status: 'SUCCEEDED', alreadyConfirmed },
  });
}) as typeof fetch;

const first = await confirmSandboxPaymentThroughSettlementService({ ...baseInput, fetchImpl: idempotentDownstream });
const retry = await confirmSandboxPaymentThroughSettlementService({ ...baseInput, fetchImpl: idempotentDownstream });
assert.equal(first.alreadyConfirmed, false);
assert.equal(retry.alreadyConfirmed, true);
assert.equal(canonicalConfirmationCount, 1);
checks += 3;

console.info(`Sandbox reconciliation relay verifier passed (${checks} checks).`);
