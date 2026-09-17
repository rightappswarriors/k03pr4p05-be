import { GraphQLError } from 'graphql';

export type SettlementRelayErrorCode =
  | 'SETTLEMENT_SERVICE_NOT_CONFIGURED'
  | 'SETTLEMENT_SERVICE_UNAVAILABLE'
  | 'SETTLEMENT_SERVICE_TIMEOUT'
  | 'SETTLEMENT_SERVICE_AUTH_REJECTED'
  | 'SETTLEMENT_SERVICE_REJECTED'
  | 'SETTLEMENT_CONFIRMATION_FAILED'
  | 'SETTLEMENT_SERVICE_PROTOCOL_ERROR';

type SettlementRelayInput = {
  baseUrl: string;
  serviceKey: string;
  paymentTransactionId: string;
  reason: string;
  actorUserId: number;
  actorOrgId: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type SettlementRelayResult = {
  id: string;
  status: string;
  alreadyConfirmed: boolean;
};

const DEFAULT_TIMEOUT_MS = 10_000;

export class SettlementRelayError extends GraphQLError {
  constructor(code: SettlementRelayErrorCode, message: string) {
    super(message, { extensions: { code } });
  }
}

function safeErrorDetails(error: unknown) {
  const candidate = error as any;
  const nested = candidate?.cause?.errors?.find?.((item: any) => item?.code) ?? candidate?.cause;
  return {
    name: String(candidate?.name ?? 'Error').slice(0, 80),
    causeCode: String(nested?.code ?? candidate?.code ?? '').slice(0, 80) || undefined,
    causeMessage: String(nested?.message ?? candidate?.cause?.message ?? candidate?.message ?? '')
      .replace(/[\r\n]+/g, ' ')
      .slice(0, 240),
  };
}

function relayError(code: SettlementRelayErrorCode, message: string): never {
  throw new SettlementRelayError(code, message);
}

export async function confirmSandboxPaymentThroughSettlementService(
  input: SettlementRelayInput,
): Promise<SettlementRelayResult> {
  let target: URL;
  try {
    const base = new URL(input.baseUrl.endsWith('/') ? input.baseUrl : `${input.baseUrl}/`);
    if (base.protocol !== 'http:' && base.protocol !== 'https:') throw new Error('Unsupported protocol.');
    target = new URL(
      `payments/admin/sandbox-reconciliation/${encodeURIComponent(input.paymentTransactionId)}/confirm`,
      base,
    );
  } catch {
    relayError(
      'SETTLEMENT_SERVICE_NOT_CONFIGURED',
      'Sandbox settlement service is not configured. No payment status was changed.',
    );
  }

  const timeoutMs = Number.isFinite(input.timeoutMs)
    ? Math.min(60_000, Math.max(1, Number(input.timeoutMs)))
    : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const diagnosticTarget = {
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? '443' : '80'),
    pathname: target.pathname,
    method: 'POST',
  };

  let response: Response;
  let responseText: string;
  try {
    response = await (input.fetchImpl ?? fetch)(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sandbox-settlement-key': input.serviceKey,
      },
      body: JSON.stringify({
        reason: input.reason,
        actorUserId: input.actorUserId,
        actorOrgId: input.actorOrgId,
      }),
      redirect: 'error',
      signal: controller.signal,
    });
    responseText = await response.text();
  } catch (error) {
    const details = safeErrorDetails(error);
    console.warn('[Sandbox settlement relay request failed]', { ...diagnosticTarget, ...details });
    if (controller.signal.aborted || details.name === 'AbortError' || details.causeCode === 'ETIMEDOUT') {
      relayError(
        'SETTLEMENT_SERVICE_TIMEOUT',
        'Sandbox settlement confirmation timed out. No payment status was changed by the Portal. Try again.',
      );
    }
    relayError(
      'SETTLEMENT_SERVICE_UNAVAILABLE',
      'Payment evidence was verified, but the settlement service is unavailable. No funds were posted. Start the Kompra Web backend and try again.',
    );
  } finally {
    clearTimeout(timeout);
  }

  let body: any;
  try {
    body = JSON.parse(responseText);
  } catch {
    console.warn('[Sandbox settlement relay protocol failure]', { ...diagnosticTarget, responseStatus: response.status });
    relayError(
      'SETTLEMENT_SERVICE_PROTOCOL_ERROR',
      'The settlement service returned an invalid response. No payment status was changed by the Portal.',
    );
  }

  if (response.status === 401 || response.status === 403) {
    console.warn('[Sandbox settlement relay authentication rejected]', { ...diagnosticTarget, responseStatus: response.status });
    relayError(
      'SETTLEMENT_SERVICE_AUTH_REJECTED',
      'The settlement service rejected its server credential. No payment status was changed.',
    );
  }
  if (response.status >= 500) {
    console.warn('[Sandbox settlement relay downstream failure]', { ...diagnosticTarget, responseStatus: response.status });
    relayError(
      'SETTLEMENT_CONFIRMATION_FAILED',
      'The payment evidence is valid, but settlement confirmation could not be completed. No payment status was changed by the Portal.',
    );
  }
  if (!response.ok || body?.success !== true) {
    console.warn('[Sandbox settlement relay request rejected]', { ...diagnosticTarget, responseStatus: response.status });
    relayError(
      'SETTLEMENT_SERVICE_REJECTED',
      'The settlement service rejected the reconciliation request. No payment status was changed.',
    );
  }
  if (
    !body?.data ||
    typeof body.data.id !== 'string' ||
    body.data.id !== input.paymentTransactionId ||
    body.data.status !== 'SUCCEEDED' ||
    typeof body.data.alreadyConfirmed !== 'boolean'
  ) {
    console.warn('[Sandbox settlement relay protocol failure]', { ...diagnosticTarget, responseStatus: response.status });
    relayError(
      'SETTLEMENT_SERVICE_PROTOCOL_ERROR',
      'The settlement service returned an invalid confirmation response. Verify payment state before retrying.',
    );
  }

  return body.data as SettlementRelayResult;
}
