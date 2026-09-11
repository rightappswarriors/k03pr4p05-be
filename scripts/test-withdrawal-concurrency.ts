import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { requestWithdrawal } from '../src/services/supplierSettlement.service.js'
//cd k03pr4p05-be
//npx tsx scripts/test-withdrawal-concurrency.ts --payout-method-id <id> --amount 40000 --concurrent 2
const valueFor = (flag: string) => {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const payoutMethodId = Number(valueFor('--payout-method-id'))
const amount = Number(valueFor('--amount'))
const concurrent = Number(valueFor('--concurrent') ?? '2')
if (!Number.isInteger(payoutMethodId) || payoutMethodId <= 0 || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(concurrent) || concurrent < 2) {
  throw new Error('Usage: npx tsx scripts/test-withdrawal-concurrency.ts --payout-method-id <id> --amount <amount> --concurrent 2')
}

async function snapshot(walletId: number) {
  const [wallet, withdrawalCount, ledgerCount] = await Promise.all([
    prisma.wallet.findUniqueOrThrow({ where: { id: walletId } }),
    prisma.withdrawal.count({ where: { walletId, deletedAt: null } }),
    prisma.walletLedgerEntry.count({ where: { walletId, sourceType: 'WITHDRAWAL', deletedAt: null } }),
  ])
  return { balance: wallet.balance, heldBalance: wallet.heldBalance, withdrawalCount, ledgerCount }
}

async function runRequest(orgId: number, requestedById: number) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => requestWithdrawal(tx, { orgId, payoutMethodId, amount, requestedById }), { isolationLevel: 'Serializable' })
    } catch (error: any) {
      if (error?.code === 'P2034' && attempt < 2) continue
      throw error
    }
  }
  throw new Error('Withdrawal request could not complete after serializable retries.')
}

async function main() {
  const payoutMethod = await prisma.payoutMethod.findFirstOrThrow({ where: { id: payoutMethodId, deletedAt: null, isActive: true } })
  if (!payoutMethod.isVerified) throw new Error('The supplied payout method must be verified.')
  const wallet = await prisma.wallet.findFirstOrThrow({ where: { orgId: payoutMethod.orgId, environment: payoutMethod.environment, deletedAt: null } })
  const supplierUser = await prisma.user.findFirst({ where: { organizationId: payoutMethod.orgId }, select: { id: true } })
  if (!supplierUser) throw new Error('No user exists for the payout method organization; cannot establish a test supplier context.')

  console.log('Before', await snapshot(wallet.id))
  const results = await Promise.allSettled(Array.from({ length: concurrent }, () => runRequest(payoutMethod.orgId, supplierUser.id)))
  results.forEach((result, index) => console.log(`Request ${index + 1}`, result.status === 'fulfilled' ? { success: true, withdrawalId: result.value.id, status: result.value.status } : { success: false, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }))
  console.log('After', await snapshot(wallet.id))
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
