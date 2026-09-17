import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';

const endpoint = process.env.PORTAL_GRAPHQL_URL ?? 'http://localhost:4000/graphql';
const socketEndpoint = endpoint.replace(/^http/, 'ws').replace(/\/graphql$/, '');
const prisma = new PrismaClient();

async function graphql<T>(query: string, variables: Record<string, unknown>, token?: string): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.map((error) => error.message).join('; ') || `HTTP ${response.status}`);
  return payload.data as T;
}

async function login(email: string, password: string) {
  const data = await graphql<{ login: { token: string } }>(
    'mutation Login($email:String!,$password:String!){login(email:$email,password:$password){token}}',
    { email, password },
  );
  return data.login.token;
}

async function expectReject(run: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(run, pattern);
}

function openSocket(token: string) {
  return new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(`${socketEndpoint}?token=${encodeURIComponent(token)}`);
    const timer = setTimeout(() => reject(new Error('WebSocket connection timed out')), 10_000);
    socket.once('open', () => { clearTimeout(timer); resolve(socket); });
    socket.once('error', reject);
  });
}

function waitForEvent(socket: WebSocket, event: string, conversationId?: string) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('message', onMessage); reject(new Error(`Timed out waiting for ${event}`)); }, 10_000);
    const onMessage = (raw: WebSocket.RawData) => {
      const value = JSON.parse(raw.toString());
      if (value.event === event && (!conversationId || value.conversationId === conversationId || value.payload?.conversationId === conversationId)) {
        clearTimeout(timer);
        socket.off('message', onMessage);
        resolve(value);
      }
    };
    socket.on('message', onMessage);
  });
}

async function main() {
  const retailerToken = await login('seller@seller.dev.com', 'seller123');
  const supplierToken = await login('supplier@supplier.dev.com', 'supplier123');
  const link = await prisma.supplierOutletLink.findFirstOrThrow({ where: { status: 'APPROVED' }, include: { outlet: true } });
  const item = await prisma.supplierItem.findFirstOrThrow({ where: { catalog: { organizationId: link.supplierOrgId }, isActive: true, deletedAt: null }, include: { variants: { where: { isActive: true, deletedAt: null }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] } }, orderBy: { unitPrice: 'desc' } });
  const variant = item.variants[0];
  const orderUnitPrice = variant?.price || item.unitPrice;
  const qty = Math.max(item.moq, Math.ceil(25_001 / orderUnitPrice));
  const requestId = `day21-3-live-${Date.now()}`;
  const created = await graphql<{ createRetailerPurchaseOrder: { id: string; poNumber: string; totalAmount: number; conversationId: string } }>(
    'mutation Create($input:CreateRetailerPurchaseOrderInput!){createRetailerPurchaseOrder(input:$input){id poNumber totalAmount conversationId}}',
    { input: { linkId: link.id, requestId, lineItems: [{ supplierItemId: item.id, ...(variant ? { supplierItemVariantId: variant.id } : {}), qty }] } }, retailerToken,
  );
  const po = created.createRetailerPurchaseOrder;
  assert.ok(po.totalAmount > 25_000, 'live PO must exercise COD denial');

  const expectedDeliveryDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const acceptMutation = 'mutation Accept($input:AcceptPurchaseOrderInput!){acceptPurchaseOrder(input:$input){id status supplierConfirmation conversationId}}';
  const accepted = await graphql<{ acceptPurchaseOrder: { id: string; status: string; supplierConfirmation: string } }>(acceptMutation, { input: { purchaseOrderId: po.id, expectedDeliveryDate } }, supplierToken);
  const acceptedRetry = await graphql<{ acceptPurchaseOrder: { id: string; status: string; supplierConfirmation: string } }>(acceptMutation, { input: { purchaseOrderId: po.id, expectedDeliveryDate } }, supplierToken);
  assert.equal(accepted.acceptPurchaseOrder.id, acceptedRetry.acceptPurchaseOrder.id);
  assert.equal(accepted.acceptPurchaseOrder.supplierConfirmation, 'CONFIRMED');
  assert.equal(await prisma.notification.count({ where: { orgId: link.outlet.orgId, conversationId: po.conversationId, title: 'Purchase order accepted' } }), 1);

  const paymentMutation = 'mutation Method($purchaseOrderId:String!,$paymentMethod:PaymentMethod!){setRetailerPurchaseOrderPaymentMethod(purchaseOrderId:$purchaseOrderId,paymentMethod:$paymentMethod){id paymentMethod}}';
  await expectReject(() => graphql(paymentMutation, { purchaseOrderId: po.id, paymentMethod: 'E_WALLET' }, retailerToken), /delivery (location|address)/i);

  const deliveryInput = { purchaseOrderId: po.id, address: 'Day 21.3 Test Delivery, Manila', latitude: 14.5995, longitude: 120.9842, instructions: 'Call the receiving desk.' };
  const deliveryMutation = 'mutation Delivery($input:ConfirmRetailerPurchaseOrderDeliveryLocationInput!){confirmRetailerPurchaseOrderDeliveryLocation(input:$input){id delivery{id address latitude longitude notes}}}';
  await expectReject(() => graphql(deliveryMutation, { input: deliveryInput }, supplierToken), /Retailer organization|not found/i);
  const delivery = await graphql<{ confirmRetailerPurchaseOrderDeliveryLocation: { id: string; delivery: { id: string; address: string; latitude: number; longitude: number } } }>(deliveryMutation, { input: deliveryInput }, retailerToken);
  const deliveryRetry = await graphql<{ confirmRetailerPurchaseOrderDeliveryLocation: { id: string } }>(deliveryMutation, { input: deliveryInput }, retailerToken);
  assert.equal(delivery.confirmRetailerPurchaseOrderDeliveryLocation.id, deliveryRetry.confirmRetailerPurchaseOrderDeliveryLocation.id);
  assert.equal(delivery.confirmRetailerPurchaseOrderDeliveryLocation.delivery.address, deliveryInput.address);
  assert.equal(await prisma.notification.count({ where: { orgId: link.supplierOrgId, conversationId: po.conversationId, title: 'Delivery address confirmed' } }), 1);

  const eligibility = await graphql<{ retailerPurchaseOrderPaymentEligibility: { codEligible: boolean; mayaEligible: boolean; deliveryAddressConfirmed: boolean; bankTransferSupported: boolean } }>(
    'query Eligibility($id:String!){retailerPurchaseOrderPaymentEligibility(purchaseOrderId:$id){codEligible mayaEligible deliveryAddressConfirmed bankTransferSupported}}',
    { id: po.id }, retailerToken,
  );
  assert.deepEqual(eligibility.retailerPurchaseOrderPaymentEligibility, { codEligible: false, mayaEligible: true, deliveryAddressConfirmed: true, bankTransferSupported: false });
  await expectReject(() => graphql(paymentMutation, { purchaseOrderId: po.id, paymentMethod: 'CASH' }, retailerToken), /25,000/);

  const retailerSocket = await openSocket(retailerToken);
  const supplierSocket = await openSocket(supplierToken);
  try {
    retailerSocket.send(JSON.stringify({ event: 'conversation:join', conversationId: po.conversationId }));
    supplierSocket.send(JSON.stringify({ event: 'conversation:join', conversationId: po.conversationId }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    const supplierReceives = waitForEvent(supplierSocket, 'conversation:newMessage', po.conversationId);
    await graphql('mutation Send($input:SendPoMessageInput!){sendPoMessage(input:$input){id}}', { input: { poId: po.id, message: 'Hello Supplier', clientMessageId: `${requestId}-retailer` } }, retailerToken);
    assert.equal((await supplierReceives).payload.message, 'Hello Supplier');
    const retailerReceives = waitForEvent(retailerSocket, 'conversation:newMessage', po.conversationId);
    await graphql('mutation Send($input:SendPoMessageInput!){sendPoMessage(input:$input){id}}', { input: { poId: po.id, message: 'Order received.', clientMessageId: `${requestId}-supplier` } }, supplierToken);
    assert.equal((await retailerReceives).payload.message, 'Order received.');
    const forbidden = waitForEvent(retailerSocket, 'conversation:forbidden', 'not-a-real-conversation');
    retailerSocket.send(JSON.stringify({ event: 'conversation:join', conversationId: 'not-a-real-conversation' }));
    await forbidden;
  } finally {
    retailerSocket.close();
    supplierSocket.close();
  }

  const persisted = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id }, include: { delivery: true, Conversation: { include: { ConversationMessage: true } } } });
  assert.equal(persisted.delivery?.address, deliveryInput.address);
  assert.ok(persisted.Conversation?.ConversationMessage.some((message) => message.message === 'Hello Supplier'));
  assert.ok(persisted.Conversation?.ConversationMessage.some((message) => message.message === 'Order received.'));
  console.log(JSON.stringify({ poId: po.id, poNumber: po.poNumber, totalAmount: po.totalAmount, conversationId: po.conversationId }));
}

main().finally(() => prisma.$disconnect());
