import { objectType, extendType, nonNull, nullable, arg, stringArg, floatArg } from 'nexus';
// ─── SalaryHistory Object Type ────────────────────────────────────────────────
export const SalaryHistory = objectType({
    name: 'SalaryHistory',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.float('ammount'); // preserves schema spelling
        t.nonNull.dateTime('effectiveAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.string('userId');
        t.nonNull.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => ctx.prisma.salaryHistory
                .findUnique({ where: { id: parent.id } })
                .employee(),
        });
    },
});
// ─── Extend Employee to expose salaryHistories ────────────────────────────────
export const EmployeeWithSalaryHistory = extendType({
    type: 'Employee',
    definition(t) {
        t.nonNull.list.nonNull.field('salaryHistories', {
            type: 'SalaryHistory',
            resolve: (parent, _, ctx) => ctx.prisma.employee
                .findUnique({ where: { id: parent.id } })
                .salaryHistories({ where: { deletedAt: null }, orderBy: { effectiveAt: 'desc' } }),
        });
    },
});
// ─── Queries ──────────────────────────────────────────────────────────────────
export const SalaryHistoryQuery = extendType({
    type: 'Query',
    definition(t) {
        // All non-deleted snapshots for an employee, newest first
        t.nonNull.list.nonNull.field('getSalaryHistory', {
            type: 'SalaryHistory',
            args: {
                employeeId: nonNull(arg({ type: 'ID' })),
            },
            async resolve(_, { employeeId }, ctx) {
                if (!ctx.user)
                    throw new Error('Authentication required');
                return ctx.prisma.salaryHistory.findMany({
                    where: { employeeId: String(employeeId), deletedAt: null },
                    orderBy: { effectiveAt: 'desc' },
                });
            },
        });
        // Most-recent snapshot only — handy for displaying current salary provenance
        t.nullable.field('getLatestSalary', {
            type: 'SalaryHistory',
            args: {
                employeeId: nonNull(arg({ type: 'ID' })),
            },
            async resolve(_, { employeeId }, ctx) {
                if (!ctx.user)
                    throw new Error('Authentication required');
                return ctx.prisma.salaryHistory.findFirst({
                    where: { employeeId: String(employeeId), deletedAt: null },
                    orderBy: { effectiveAt: 'desc' },
                });
            },
        });
    },
});
// ─── Mutations ────────────────────────────────────────────────────────────────
export const SalaryHistoryMutation = extendType({
    type: 'Mutation',
    definition(t) {
        /**
         * recordSalarySnapshot — creates a history row AND syncs Employee.salary.
         * Called automatically by updateEmployee when salary changes, but can also
         * be called directly for backdated adjustments (pass effectiveAt).
         */
        t.nonNull.field('recordSalarySnapshot', {
            type: 'SalaryHistory',
            args: {
                employeeId: nonNull(arg({ type: 'ID' })),
                ammount: nonNull(floatArg()),
                effectiveAt: nullable(stringArg()), // ISO string; defaults to now()
            },
            async resolve(_, { employeeId, ammount, effectiveAt }, ctx) {
                if (!ctx.user)
                    throw new Error('Authentication required');
                const resolvedDate = effectiveAt ? new Date(effectiveAt) : new Date();
                // Atomic: snapshot + live salary stay in sync
                const [snapshot] = await ctx.prisma.$transaction([
                    ctx.prisma.salaryHistory.create({
                        data: {
                            id: crypto.randomUUID(),
                            employeeId: String(employeeId),
                            ammount,
                            effectiveAt: resolvedDate,
                        },
                    }),
                    ctx.prisma.employee.update({
                        where: { id: String(employeeId) },
                        data: { salary: ammount },
                    }),
                ]);
                return snapshot;
            },
        });
        // Soft-delete a single snapshot (audit trail stays intact)
        t.nonNull.field('deleteSalarySnapshot', {
            type: 'SalaryHistory',
            args: {
                id: nonNull(arg({ type: 'ID' })),
            },
            async resolve(_, { id }, ctx) {
                if (!ctx.user)
                    throw new Error('Authentication required');
                return ctx.prisma.salaryHistory.update({
                    where: { id: String(id) },
                    data: { deletedAt: new Date() },
                });
            },
        });
    },
});
