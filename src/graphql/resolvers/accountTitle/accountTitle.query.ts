import { extendType, intArg } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js'

const ACCOUNT_TITLE_OPTIONS = [
  'Accounts In Litigation',
  'Accounts Payable',
  'Accounts Payable - Cash Bond',
  'Accounts Payable - Delinquent',
  'Accounts Payable - Sanhec',
  'Accounts Payable - Sinking Fund',
  'Accounts Receivable - Audit',
  'Accounts Receivable - Branches',
  'Accounts Receivable - Calamity Loan',
  'Accounts Receivable - Deceased',
  'Accounts Receivable - Donations',
  'Accounts Receivable - Employees',
  'Accounts Receivable - Insurance',
  'Accounts Receivable - Others',
  'Accounts Receivable - Shortage',
  'Accounts Receivable - SSS',
  'Accounts Receivable - Vale',
  'Accrued Expenses Payable',
  'Accum Depreciation & Amortization',
  'Accum Net Profit',
  'Accum Amort - Computer Software',
  'Accum Depn. - Furnitures & Fixtures',
  'Accum Depn. - Land Improvements',
];

export const accountTitleQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('getAllAccountTitles', {
      type: 'AccountTitle',
      resolve: async (_, {}, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER'])
        const orgId = Number(ctx.user.orgId)
        
        try {
          // ✅ Added await
          const accountTitles = await ctx.prisma.accountTitle.findMany({
            where: { orgId }
          })
          
          // ✅ Properly check if empty
          if (accountTitles.length === 0) {
            console.log(`Seeding ${ACCOUNT_TITLE_OPTIONS.length} account titles for org ${orgId}...`)
            
            // ✅ Seed the database
            await ctx.prisma.accountTitle.createMany({
              data: ACCOUNT_TITLE_OPTIONS.map((label) => ({
                label,
                orgId
              }))
            })
            
            // ✅ Fetch and return the newly created records
            return await ctx.prisma.accountTitle.findMany({
              where: { orgId }
            })
          }
          
          return accountTitles
        } catch (error: any) {
          console.error("Error fetching account titles:", error)
          throw error // Let GraphQL handle the error response
        }
      }
    })
    
    t.field('accountTitle', {
      type: 'AccountTitle',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER'])
        return ctx.prisma.accountTitle.findUnique({
          where: { id }
        })
      }
    })
  }
})