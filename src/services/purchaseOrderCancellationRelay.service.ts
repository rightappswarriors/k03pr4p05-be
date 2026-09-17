import { GraphQLError } from 'graphql'

export type PurchaseOrderCancellationResult = {
  purchaseOrderId: string
  poNumber: string
  orderStatus: string
  paymentStatus: string
  buyerOrgId: number | null
  supplierOrgId: number
  cancellation: null | {
    id: string
    status: string
    reason: string
    requestedAt: string
    decidedAt: string | null
    cancelledAt: string | null
    requestedByOrgId: number | null
    requestedByUserId: number | null
    approvedByOrgId: number | null
    approvedByUserId: number | null
    rejectedByOrgId: number | null
    rejectedByUserId: number | null
  }
  refund: null | {
    id: string
    status: string
    amount: number
    currency: string
    requestedAt: string
    completedAt: string | null
    providerRefundId: string | null
    environment: string
  }
  inspection?: null | {
    paymentTransactionId: string | null
    paymentProvider: string | null
    providerReference: string | null
    paymentAmount: number | null
    supplierNet: number | null
    platformFee: number | null
    environment: string | null
    escrowStatus: string | null
    escrowReversalEntryId: number | null
    settlementId: string | null
    platformFeeDisposition: string
  }
  idempotent: boolean
}

type CancellationAction = 'state' | 'request' | 'approve' | 'reject'

type RelayInput = {
  baseUrl: string
  serviceKey: string
  purchaseOrderId: string
  action: CancellationAction
  reason?: string
  actorUserId?: number
  actorOrgId?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 10_000

function domainError(code: string, message: string): never {
  throw new GraphQLError(message, { extensions: { code } })
}

function safeCause(error: unknown) {
  const candidate = error as any
  const nested = candidate?.cause?.errors?.find?.((item: any) => item?.code) ?? candidate?.cause
  return {
    name: String(candidate?.name ?? 'Error').slice(0, 80),
    causeCode: String(nested?.code ?? candidate?.code ?? '').slice(0, 80) || undefined,
  }
}

export async function relayPurchaseOrderCancellation(input: RelayInput): Promise<PurchaseOrderCancellationResult> {
  let target: URL
  try {
    const base = new URL(input.baseUrl.endsWith('/') ? input.baseUrl : `${input.baseUrl}/`)
    if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Unsupported protocol')
    const suffix = input.action === 'state' ? 'cancellation' : `cancellation/${input.action}`
    target = new URL(`payments/admin/purchase-orders/${encodeURIComponent(input.purchaseOrderId)}/${suffix}`, base)
  } catch {
    domainError('COMMERCE_SERVICE_NOT_CONFIGURED', 'The purchase order service is not configured. No order state was changed.')
  }

  const controller = new AbortController()
  const timeoutMs = Number.isFinite(input.timeoutMs) ? Math.min(60_000, Math.max(1, Number(input.timeoutMs))) : DEFAULT_TIMEOUT_MS
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const diagnostic = { hostname: target.hostname, port: target.port || (target.protocol === 'https:' ? '443' : '80'), pathname: target.pathname, method: input.action === 'state' ? 'GET' : 'POST' }
  let response: Response
  let responseText = ''
  try {
    response = await (input.fetchImpl ?? fetch)(target, {
      method: diagnostic.method,
      headers: { 'Content-Type': 'application/json', 'x-portal-commerce-key': input.serviceKey },
      ...(input.action === 'state' ? {} : { body: JSON.stringify({ reason: input.reason, actorUserId: input.actorUserId, actorOrgId: input.actorOrgId }) }),
      redirect: 'error',
      signal: controller.signal,
    })
    responseText = await response.text()
  } catch (error) {
    const details = safeCause(error)
    console.warn('[Purchase order cancellation relay failed]', { ...diagnostic, ...details })
    if (controller.signal.aborted || details.name === 'AbortError' || details.causeCode === 'ETIMEDOUT') {
      domainError('COMMERCE_SERVICE_TIMEOUT', 'The purchase order service timed out. No order or payment state was changed. Try again.')
    }
    domainError('COMMERCE_SERVICE_UNAVAILABLE', 'The purchase order service is unavailable. No order or payment state was changed. Start the Kompra Web backend and try again.')
  } finally {
    clearTimeout(timeout)
  }

  let body: any
  try {
    body = JSON.parse(responseText)
  } catch {
    console.warn('[Purchase order cancellation relay protocol failure]', { ...diagnostic, responseStatus: response.status })
    domainError('COMMERCE_SERVICE_PROTOCOL_ERROR', 'The purchase order service returned an invalid response. Refresh before retrying.')
  }
  if (response.status === 401 || response.status === 403) {
    domainError('COMMERCE_SERVICE_AUTH_REJECTED', 'The purchase order service rejected its server credential. No order or payment state was changed.')
  }
  if (response.status >= 500) {
    domainError('COMMERCE_SERVICE_FAILED', 'The purchase order action could not be completed. No unverified refund was recorded.')
  }
  if (!response.ok || body?.success !== true) {
    const safeMessage = typeof body?.message === 'string' ? body.message : typeof body?.error?.message === 'string' ? body.error.message : null
    domainError('PURCHASE_ORDER_CANCELLATION_REJECTED', safeMessage || 'The purchase order action is not allowed in its current state.')
  }
  if (!body?.data || body.data.purchaseOrderId !== input.purchaseOrderId || typeof body.data.orderStatus !== 'string') {
    domainError('COMMERCE_SERVICE_PROTOCOL_ERROR', 'The purchase order service returned an invalid response. Refresh before retrying.')
  }
  return body.data as PurchaseOrderCancellationResult
}

export function purchaseOrderCancellationRelayConfig() {
  const baseUrl = process.env.KOMPRA_WEB_API_URL?.trim() ?? ''
  const serviceKey = process.env.PORTAL_COMMERCE_SERVICE_KEY?.trim()
    || (process.env.NODE_ENV !== 'production' ? process.env.SANDBOX_SETTLEMENT_SERVICE_KEY?.trim() : '')
  if (!baseUrl || !serviceKey) domainError('COMMERCE_SERVICE_NOT_CONFIGURED', 'The purchase order service is not configured. No order state was changed.')
  return { baseUrl, serviceKey }
}
