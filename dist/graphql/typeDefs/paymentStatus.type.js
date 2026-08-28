import { enumType } from 'nexus';
export const PaymentStatus = enumType({
    name: 'PaymentStatus',
    members: ['PENDING', 'PARTIAL', 'PAID', 'PREPARING', 'REFUNDED'],
});
