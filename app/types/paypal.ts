export type PayPalEnvironment = 'sandbox' | 'live';

export type PayPalCurrencyCode = 'USD' | 'KRW';

export type PayPalOrderIntent = 'CAPTURE';

export type PayPalOrderStatus =
  | 'CREATED'
  | 'SAVED'
  | 'APPROVED'
  | 'VOIDED'
  | 'COMPLETED'
  | 'PAYER_ACTION_REQUIRED';

export interface PayPalAmount {
  currency_code: PayPalCurrencyCode;
  value: string;
}

export interface PayPalPurchaseUnit {
  reference_id?: string;
  description?: string;
  custom_id?: string;
  amount: PayPalAmount;
}

export interface PayPalLink {
  href: string;
  rel: string;
  method: string;
}

export interface PayPalCreateOrderRequest {
  intent: PayPalOrderIntent;
  purchase_units: PayPalPurchaseUnit[];
}

export interface PayPalOrder {
  id: string;
  status: PayPalOrderStatus;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    amount?: PayPalAmount;
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: PayPalAmount;
      }>;
    };
  }>;
  links?: PayPalLink[];
}

export interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface PayPalApiErrorDetail {
  issue?: string;
  description?: string;
}

export interface PayPalApiErrorResponse {
  name?: string;
  message?: string;
  debug_id?: string;
  details?: PayPalApiErrorDetail[];
}

export interface PayPalCreateOrderParams {
  amount: number;
  currencyCode?: PayPalCurrencyCode;
  orderId: string;
  description: string;
}

export interface PayPalCaptureResult {
  orderId: string;
  status: PayPalOrderStatus;
  captureId: string | null;
  amount: PayPalAmount | null;
  raw: PayPalOrder;
}
