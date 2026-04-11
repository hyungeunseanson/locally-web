export type CardPaymentProvider = 'portone' | 'nicepay';

export type CardPaymentPublicRuntime = {
  provider: CardPaymentProvider;
  merchantCode: string;
  scriptSrc: string;
  publicClientKey?: string;
};

export type CardPaymentReadinessReason =
  | 'missing_imp_code'
  | 'missing_portone_credentials'
  | 'missing_nicepay_credentials'
  | 'unsupported_provider';

export type CardPaymentReadiness = {
  provider: CardPaymentProvider;
  ready: boolean;
  reason?: CardPaymentReadinessReason;
  missingConfig?: string[];
  runtime?: CardPaymentPublicRuntime;
};

export type CardPaymentLaunchParams = {
  provider: CardPaymentProvider;
  merchantCode: string;
  publicClientKey?: string;
  orderId: string;
  productName: string;
  amount: number;
  buyerEmail?: string;
  buyerName: string;
  buyerTel: string;
  redirectUrl: string;
};

export type CardPaymentLaunchResult = {
  provider: CardPaymentProvider;
  approvalId: string;
  raw: unknown;
};

export type VerifyApprovedCardPaymentParams = {
  provider?: CardPaymentProvider;
  approvalId: string;
  orderId: string;
  expectedAmount: number;
  providerPayload?: Record<string, string>;
};

export type VerifiedCardPayment = {
  provider: CardPaymentProvider;
  approvedAmount: number;
  providerTransactionId: string;
  raw: unknown;
};

export type CancelCardPaymentParams = {
  providerTransactionId: string;
  orderId: string;
  cancelAmount: number;
  cancelReason: string;
  totalAmount?: number;
  requireMerchantKey?: boolean;
  acceptedResultCodes?: string[];
};

export type CancelCardPaymentResult = {
  resultCode: string | null;
  resultMessage: string | null;
  raw: string;
};

export type CardPaymentNotificationEnvelope = {
  provider: CardPaymentProvider;
  idempotencyKey: string | null;
  orderId: string | null;
  providerTransactionId: string | null;
  amount: number | null;
  status: string | null;
  payload: Record<string, string>;
  rawBody: string;
  headers: Record<string, string>;
};
