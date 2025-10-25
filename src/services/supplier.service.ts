// services/supplier.service.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createSupplier = async (data) => {
  const supplier = await prisma.supplier.create({
    data,
    select: {
      id: true,
      name: true,
      address: true,
      zipCode: true,
      contactNumber: true,
      contactName: true,
      faxNumber: true,
      tinNumber: true,
    },
  });
  return supplier;
};

export const updateSupplier = async (id, data) => {
  const updated = await prisma.supplier.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      address: true,
      zipCode: true,
      contactNumber: true,
      contactName: true,
      faxNumber: true,
      tinNumber: true,
    },
  });
  return updated;
};

export const deleteSupplier = async (id) => {
  const deleted = await prisma.supplier.delete({
    where: { id },
  });
  return deleted;
};

export const getSuppliers = async () => {
  return await prisma.supplier.findMany({
    select: {
      id: true,
      name: true,
      address: true,
      zipCode: true,
      contactNumber: true,
      contactName: true,
      faxNumber: true,
      tinNumber: true,
      modesOfPayment: {
        select: {
          id: true,
          name: true,
          accountLink: true,
        },
      },
    },
  });
};

export const getSupplierById = async (id) => {
  return await prisma.supplier.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      zipCode: true,
      contactNumber: true,
      contactName: true,
      faxNumber: true,
      tinNumber: true,
      modesOfPayment: {
        select: {
          id: true,
          name: true,
          accountLink: true,
        },
      },
    },
  });
};
