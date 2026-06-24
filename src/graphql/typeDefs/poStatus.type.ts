import { enumType } from 'nexus';
export const POStatus = enumType({
    name: 'POStatus',
    members: ['PENDING', 'ACCEPTED', 'REJECTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'],
});
