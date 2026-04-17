import { extendType, intArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
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
        t.list.field('getAll', {
            type: 'AccountTitle',
            args: {
                orgId: intArg()
            },
            resolve: async (_, {}, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER']);
                const orgId = Number(ctx.user.orgId);
                try {
                    const accounTitles = ctx.prisma.accountTitle.findMany({
                        where: { orgId }
                    });
                    if (accounTitles.length === 0) {
                        // how to seed if no accountTitles?
                        if (process.env.NODE_ENV === "") {
                            console.log("Seeding account-titles.....");
                        }
                        const createdAccountTitles = ctx.prisma.accountTitle.createMany({
                            data: ACCOUNT_TITLE_OPTIONS.map((label) => ({
                                label,
                                orgId
                            }))
                        });
                        return createdAccountTitles;
                    }
                    return accounTitles;
                }
                catch (error) {
                    console.log("Error:", error);
                    return [];
                }
            }
        });
        t.field('accountTitle', {
            type: 'AccountTitle',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                requireRole(ctx, ['OWNER']);
                return ctx.prisma.accountTitle.findUnique({
                    where: { id }
                });
            }
        });
    }
});
