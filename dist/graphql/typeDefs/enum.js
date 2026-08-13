import { enumType } from 'nexus';
export const AccountLink = enumType({
    name: 'AccountLink',
    members: [
        'CASH_ON_HAND',
        'CASH_IN_BANK_BDO',
        'CASH_IN_BANK_CHINABANK',
        'CASH_IN_BANK_SECURITY_BANK',
        'ACCOUNTS_RECEIVABLE_TRADE',
        'ACCOUNTS_RECEIVABLE_NON_TRADE',
        'ADVANCES_TO_AFFILIATES',
        'ADVANCES_TO_EMPLOYEES',
        'ADVANCES_TO_OFFICERS_STOCKHOLDERS',
        'ADVANCES_TO_OUTSIDE_PERSONNEL',
        'INVENTORY_ALL_STOCKS',
        'PREPAID_INSURANCE',
        'PETTY_CASH_FUND',
        'OFFICE_EQUIPMENT',
        'OFFICE_FURNITURES_FIXTURES',
        'OFFICE_SUPPLIES',
        'UNUSED_OFFICE_SUPPLIES',
        'DELIVERY_VEHICLE',
        'SERVICE_VEHICLE',
        'LAND',
        'LEASEHOLD_IMPROVEMENTS',
        'SUBSCRIPTION_RECEIVABLE',
        'VAT_INPUT',
        'ACCUMULATED_DEP_DELIVERY_VEHICLE',
        'ACCUMULATED_DEP_LEASEHOLD_IMPROVEMENTS',
        'ACCUMULATED_DEP_OFFICE_EQUIPMENT',
        'ACCUMULATED_DEP_OFFICE_FURNITURES_FIXTURES',
        'ACCUMULATED_DEP_SERVICE_VEHICLE',
        'ACCOUNTS_PAYABLE_TRADE',
        'ACCOUNTS_PAYABLE_NON_TRADE',
        'ACCRUED_EXPENSES',
        'INCOME_TAX_PAYABLE',
        'VAT_PAYABLE',
        'WITHHOLDING_TAX_PAYABLE',
        'SSS_PHILHEALTH_PAGIBIG_CONTRIBUTIONS',
        'ORDINARY_SHARES',
        'SUBSCRIBED_ORDINARY_SHARES',
        'RETAINED_EARNINGS',
        'INTEREST_INCOME',
        'MISCELLANEOUS_INCOME',
        'OUTPUT_VAT',
        'COST_OF_SALES_ALL_STOCKS',
        'DEPRECIATION',
        'ELECTRICITY',
        'COMMUNICATION',
        'EMPLOYEE_BENEFITS',
        'FUEL_OIL',
        'INSURANCE',
        'PROFESSIONAL_FEE',
        'RENT',
        'REPAIRS_MAINTENANCE',
        'REPRESENTATION',
        'SALARIES_WAGES',
        'TAXES_LICENSES',
        'TRANSPORTATION_TRAVEL',
        'WATER',
        'INCOME_TAX',
    ],
});
// New enums for multi-tenancy and ERP
export const SubscriptionPlan = enumType({
    name: 'SubscriptionPlan',
    members: ['BASIC', 'GOLD'],
});
export const EmployeeStatus = enumType({
    name: 'EmployeeStatus',
    members: ['Active', 'On_Leave', 'Contract'],
});
export const Environment = enumType({
    name: 'Environment',
    members: ['SANDBOX', 'PRODUCTION'],
});
export const DocumentType = enumType({
    name: 'DocumentType',
    members: [
        "BUSINESS_PERMIT",
        "DTI_SEC_REGISTRATION",
        "BIR_2303",
        "VALID_ID",
        "PROOF_OF_ADDRESS",
        "OTHER",
        // Procurement Agent Verification
        "GOVERNMENT_ID_FRONT",
        "GOVERNMENT_ID_BACK",
        "SELFIE_WITH_ID",
        "TIN",
        "NBI_CLEARANCE",
        "POLICE_CLEARANCE",
        "OTHER_DOCUMENT"
    ]
});
export const VerificationStatus = enumType({
    name: 'VerificationStatus',
    members: [
        "PENDING", "APPROVED",
        "REJECTED",
        "BYPASSED_DEV" // auto-set when environment = SANDBOX and KYC enforcement is off
    ],
});
export const AgentType = enumType({
    name: 'AgentType',
    members: ['ORG_LINKED', 'STANDALONE'],
});
const MandateStatus = [
    'DRAFT',
    'SEARCHING',
    'SENT',
    'OFFERED',
    'ACCEPTED',
    'FUNDED',
    'SETTLED',
    'COMPLETED',
    'DISPUTED',
    'CANCELLED'
];
export const MandateStatusEnum = enumType({
    name: 'MandateStatus',
    members: MandateStatus,
});
export const MandateOfferStatusEnum = enumType({
    name: 'MandateOfferStatus',
    members: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'],
});
export const LedgerEntryType = enumType({
    name: 'LedgerEntryType',
    members: ['CREDIT', 'DEBIT'],
});
export const LedgerSourceType = enumType({
    name: 'LedgerSourceType',
    members: [
        'RETAIL_ORDER',
        'MANDATE_TRANSACTION',
        'WITHDRAWAL',
        'SUBSCRIPTION_FEE',
        'PLATFORM_FEE',
        "ADJUSTMENT", "ESCROW_HOLD",
        "ESCROW_RELEASE"
    ]
});
export const WithdrawalStatus = enumType({
    name: 'WithdrawalStatus',
    members: [
        'PENDING',
        'APPROVED',
        'PROCESSING',
        'COMPLETED',
        'REJECTED'
    ]
});
export const PaymentGatewayProvider = enumType({
    name: 'PaymentGatewayProvider',
    members: ['PAYMONGO', 'GCASH', 'PAYMAYA', 'BANK_API']
});
export const PayoutMethodType = enumType({
    name: 'PayoutMethodType',
    members: ['BANK_TRANSFER', 'GCASH', 'PAYMAYA', 'CHECK']
});
export const LedgerEntryStatus = enumType({
    name: 'LedgerEntryStatus',
    members: [
        'HELD', // Phase 2 escrow: posted but not withdrawable yet
        'AVAILABLE',
        'RELEASED',
        'REVERSED'
    ]
});
export const PaymentTransactionStatus = enumType({
    name: 'PaymentTransactionStatus',
    members: ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED']
});
export const PaymentRelatedType = enumType({
    name: 'PaymentRelatedType',
    members: ['KOMPRA_C_ORDER', 'SALES_ORDER', 'MANDATE_TRANSACTION', 'SUBSCRIPTION']
});
export const SettlementType = enumType({
    name: 'SettlementType',
    members: ['INSTANT', 'ESCROW']
});
export const MandateTransactionStatus = enumType({
    name: 'MandateTransactionStatus',
    members: [
        'PENDING',
        'FUNDED',
        'SETTLED',
        'COMPLETED',
        'DISPUTED',
        'CANCELLED',
        'REFUNDED'
    ]
});
export const DisputeStatus = enumType({
    name: 'DisputeStatus',
    members: ['NONE', 'RAISED', 'UNDER_REVIEW', 'RESOLVED']
});
export const FeeApplication = enumType({
    name: 'FeeApplication',
    members: ['MANDATE_TRANSACTION', 'RETAIL_ORDER']
});
export const FeeRateType = enumType({
    name: 'FeeRateType',
    members: ['PERCENTAGE', 'PER_UNIT', 'FLAT']
});
export const AuditAction = enumType({
    name: 'AuditAction',
    members: ['CREATE', 'EDIT', 'DELETE', 'VIEW', 'LOGIN', 'LOGOUT', 'PERMISSION_CHANGE', 'STATUS_CHANGE', 'MARKETPLACE_PUBLISH', 'MARKETPLACE_UNPUBLISH'],
});
export const AgentStatus = enumType({
    name: 'AgentStatus',
    members: ['REGISTERED', 'PENDING_VERIFICATION', 'PENDING_ORGANIZATION_APPROVAL', 'ACTIVE', 'REJECTED'],
});
