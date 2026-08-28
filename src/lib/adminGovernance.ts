import { requireAuth } from '../middleware/auth.middleware.js';
import type { Context } from './types.js';

export const ADMIN_PERMISSIONS = {
  DASHBOARD_VIEW: 'ADMIN_DASHBOARD_VIEW', ORGANIZATION_VIEW: 'ORGANIZATION_VIEW', ORGANIZATION_VERIFY: 'ORGANIZATION_VERIFY',
  ORGANIZATION_SUSPEND: 'ORGANIZATION_SUSPEND', ORGANIZATION_BAN: 'ORGANIZATION_BAN', AGENT_VIEW: 'AGENT_VIEW',
  AGENT_VERIFY: 'AGENT_VERIFY', AGENT_SUSPEND: 'AGENT_SUSPEND', AGENT_BAN: 'AGENT_BAN', PLATFORM_WALLET_VIEW: 'PLATFORM_WALLET_VIEW',
  PLATFORM_LEDGER_VIEW: 'PLATFORM_LEDGER_VIEW', PLATFORM_WALLET_ADJUST: 'PLATFORM_WALLET_ADJUST', ADMIN_AUDIT_VIEW: 'ADMIN_AUDIT_VIEW',
  COMMERCE_DASHBOARD_VIEW: 'COMMERCE_DASHBOARD_VIEW', WALLET_ADMIN: 'WALLET_ADMIN', WITHDRAWAL_ADMIN_VIEW: 'WITHDRAWAL_ADMIN_VIEW', WITHDRAWAL_ADMIN_MANAGE: 'WITHDRAWAL_ADMIN_MANAGE',
} as const;

/** Platform ADMIN is deliberate and is never inherited from an org owner. */
export function requireAdmin(ctx: Context) {
  requireAuth(ctx);
  if (ctx.user?.role !== 'ADMIN') throw new Error('Platform administrator access is required.');
}

export function requireAdminPermission(ctx: Context, _permission: keyof typeof ADMIN_PERMISSIONS) {
  requireAdmin(ctx);
  // Platform ADMIN is the current explicit permission boundary. Keeping this
  // helper centralizes the policy for future dedicated platform roles.
}

export async function requireActiveOrganization(ctx: Context) {
  requireAuth(ctx);
  if (!ctx.user?.orgId) return;
  const organization = await ctx.prisma.organization.findUnique({ where: { id: ctx.user.orgId }, select: { accountStatus: true } });
  if (organization?.accountStatus === 'BANNED') throw new Error('Organization account is banned.');
  if (organization?.accountStatus === 'SUSPENDED') throw new Error('Organization account is suspended.');
}

export function requireActiveAgent(agent: { agentType: string; status: string }) {
  if (agent.agentType === 'STANDALONE' && agent.status === 'BANNED') throw new Error('Standalone agent account is banned.');
  if (agent.agentType === 'STANDALONE' && agent.status === 'SUSPENDED') throw new Error('Standalone agent account is suspended.');
}
