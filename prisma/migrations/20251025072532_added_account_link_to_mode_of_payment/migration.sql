/*
  Warnings:

  - Added the required column `accountLink` to the `ModeOfPayment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."AccountLink" AS ENUM ('Cash on Hand', 'Cash in Bank - BDO', 'Cash in Bank - Chinabank', 'Cash in Bank - Security Bank', 'Accounts Receivable - Trade', 'Accounts Receivable - Non-Trade', 'Advances to Affiliates', 'Advances to Employees', 'Advances to Officers/Stockholders', 'Advances to Outside Personnel', 'Inventory - All Stocks', 'Prepaid Insurance', 'Petty Cash Fund', 'Office Equipment', 'Office Furnitures & Fixtures', 'Office Supplies', 'Unused Office Supplies', 'Delivery Vehicle', 'Service Vehicle', 'Land', 'Leasehold Improvements', 'Subscription Receivable', 'VAT Input', 'Accumulated Depreciation - Delivery Vehicle', 'Accumulated Depreciation - Leasehold Improvements', 'Accumulated Depreciation - Office Equipment', 'Accumulated Depreciation - Office Furnitures & Fixtures', 'Accumulated Depreciation - Service Vehicle', 'Accounts Payable - Trade', 'Accounts Payable - Non-Trade', 'Accrued Expenses', 'Income Tax Payable', 'VAT Payable', 'Withholding Tax Payable', 'SSS, PhilHealth & Pag-IBIG Contributions', 'Ordinary Shares', 'Subscribed Ordinary Shares', 'Retained Earnings', 'Interest Income', 'Miscellaneous Income', 'Output VAT', 'Cost of Sales - All Stocks', 'Depreciation', 'Electricity', 'Communication', 'Employee Benefits', 'Fuel & Oil', 'Insurance', 'Professional Fee', 'Rent', 'Repairs & Maintenance', 'Representation', 'Salaries & Wages', 'Taxes & Licenses', 'Transportation & Travel', 'Water', 'Income Tax');

-- AlterTable
ALTER TABLE "public"."ModeOfPayment" ADD COLUMN     "accountLink" "public"."AccountLink" NOT NULL;
