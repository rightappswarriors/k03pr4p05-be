export type ProviderPayoutStatus = 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'RECONCILIATION_REQUIRED';

export type ProviderPayoutRequest = {
  withdrawalId: number;
  amount: number;
  encryptedDestination: string;
  destinationType: string;
  environment: 'PRODUCTION';
};

export type ProviderPayoutResult = {
  status: ProviderPayoutStatus;
  providerReference: string;
  providerMetadata?: Record<string, unknown>;
  failureCode?: string;
  failureReason?: string;
};

/**
 * Outgoing-money boundary. PayMongo/Maya checkout code is deliberately not
 * used here: this application has no verified disbursement API integration.
 */
export interface ProductionPayoutProvider {
  name: string;
  createPayout(request: ProviderPayoutRequest): Promise<ProviderPayoutResult>;
  getPayoutStatus(providerReference: string): Promise<ProviderPayoutResult>;
}

export const getProductionPayoutProvider = (): ProductionPayoutProvider => {
  throw new Error('Production payout provider is not configured.');
};
