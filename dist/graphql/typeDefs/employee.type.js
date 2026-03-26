import { objectType } from 'nexus';
export const Employee = objectType({
    name: 'Employee',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('name');
        t.nonNull.string('role');
        t.nonNull.string('department');
        t.nonNull.field('status', { type: 'EmployeeStatus' });
        t.nonNull.float('salary');
        t.nonNull.dateTime('hireDate');
        t.nonNull.string('email');
        t.nonNull.int('orgId');
        t.nullable.int('userId');
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.employee.findUnique({ where: { id: parent.id } }).org();
            }
        });
        t.nullable.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.employee.findUnique({ where: { id: parent.id } }).user();
            }
        });
    }
});
