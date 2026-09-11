import { enumType } from 'nexus';
export const POStatus = enumType({
    name: 'POStatus',
    members: ['PENDING', 'SUPPLIER_ACCEPTED', 'PREPARING', 'READY_FOR_DISPATCH', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'REJECTED', 'CANCELLED'],
});
