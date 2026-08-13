// src/graphql/typeDefs/supplierProfile.type.ts
import { objectType, enumType } from 'nexus';
export const SupplierStatusEnum = enumType({
    name: 'SupplierStatus',
    members: ['PENDING', 'APPROVED', 'REJECTED']
});
export const ApprovalStatusEnum = enumType({
    name: 'ApprovalStatus',
    members: ['PENDING', 'APPROVED', 'REJECTED']
});
export const SupplierProfile = objectType({
    name: 'SupplierProfile',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('companyName');
        t.nonNull.string('contactPerson');
        t.nonNull.string('email');
        t.nonNull.string('phone');
        t.nonNull.list.nonNull.field('productCategories', {
            type: 'String',
        });
        t.nullable.string('taxId');
        t.nullable.string('businessRegNumber');
        t.nonNull.list.nonNull.field('businessDocuments', {
            type: 'String',
        });
        t.nullable.string('address');
        t.nullable.string('city');
        t.nullable.string('province');
        t.nullable.string('zipCode');
        t.nonNull.field('status', { type: 'SupplierStatus' });
        t.nullable.string('rejectionReason');
        t.nullable.int('reviewedBy');
        t.nullable.dateTime('reviewedAt');
        t.nullable.int('userId');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierProfile
                    .findUnique({ where: { id: parent.id } })
                    .user();
            }
        });
    }
});
export const CustomerProfile = objectType({
    name: 'CustomerProfile',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.int('userId');
        t.nullable.string('phone');
        t.nullable.string('address');
        t.nullable.string('city');
        t.nullable.string('province');
        t.nullable.string('zipCode');
        t.nullable.dateTime('dateOfBirth');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nullable.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.customerProfile
                    .findUnique({ where: { id: parent.id } })
                    .user();
            }
        });
    }
});
