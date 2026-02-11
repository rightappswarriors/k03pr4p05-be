import { prisma } from '../lib/prisma.js';
export const createModeOfPayment = async (data) => {
    const newPayment = await prisma.modeOfPayment.create({
        data,
        select: {
            name: true,
        },
    });
    return newPayment;
};
export const updateModeOfPayment = async (data, paymentId) => {
    const updatedData = await prisma.modeOfPayment.update({
        where: {
            id: paymentId,
        },
        data,
        select: {
            name: true,
        },
    });
    return updatedData;
};
export const deleteModeOfPayment = async (paymentId) => {
    const deletedData = await prisma.modeOfPayment.delete({
        where: {
            id: paymentId,
        },
    });
    return deletedData;
};
export const getModeOfPayments = async () => {
    const payments = await prisma.modeOfPayment.findMany({
        select: {
            id: true,
            name: true,
            accountLink: true,
        },
    });
    return payments;
};
