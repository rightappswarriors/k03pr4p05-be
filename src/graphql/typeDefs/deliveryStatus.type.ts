import { enumType } from 'nexus';
export const DeliveryStatus = enumType({
    name: 'DeliveryStatus',
    members: ['SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'FAILED'],
});
