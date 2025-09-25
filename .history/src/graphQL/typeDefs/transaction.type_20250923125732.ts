import { objectType, enumType } from 'nexus'

export const PaymentMethod = enumType({
     name: 'PaymentMethod',
     members: ['CASH', 'CARD', 'DIGITAL']
})

export const Status = enumType({
     name: 'Status',
     members: ['PENDING', 'PAYED', 'FAILED', 'CANCELED']
})