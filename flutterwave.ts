export enum AuthorizationMode {
    PIN = 'pin',
    OTP = 'otp',
    REDIRECT = 'redirect',
    NONE = 'none',
    AVS_NOAUTH = 'avs_noauth'
  }
  
  export enum PaymentStatus {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILED = 'failed',
    REQUIRES_AUTH = 'requires_auth',
    REQUIRES_VALIDATION = 'requires_validation'
  }

  export enum PaymentAction {
    VALIDATE_OTP = 'validate_otp',
    VALIDATE_PIN = 'validate_pin',
    REDIRECT = 'redirect',
    COMPLETE = 'complete',
    FAILED = 'failed',
    VALIDATE_AVS = 'validate_avs',
    VOID = 'void'
  }

  export interface CardChargeResponse {
    status: boolean;
    message: string;
    data: {
      status?: string;  // Original Flutterwave status
      nextAction?: PaymentAction | null;
      transactionId?: string;
      txRef?: string;
      flwRef?: string;
      amount?: number;
      currency?: string;
      requiredFields?: string[];
      customer?: {
        name: string;
        email: string;
      };
      card?: {
        first6: string;
        last4: string;
        issuer: string;
        type: string;
        token?: string;
      };
      raw: any;
    };
  } 


export interface AuthorizationData {
    mode: AuthorizationMode;
    fields?: string[];
    pin?: string;
    otp?: string;
    redirect?: string;
    endpoint?: string;
  }


export interface FlutterwaveConfig {
  publicKey: string;
  secretKey: string;
  encryptionKey: string;
  redirectUrl: string;
  isTestMode: boolean;
}

export interface CardPaymentData {
  card_number: string;
  cvv: string;
  expiry_month: string;
  expiry_year: string;
  amount: number;
  email: string;
  tx_ref: string;
  currency?: string;
  fullname?: string;
  preauthorize?: boolean;
  authorization?: {
    mode: AuthorizationMode;
    pin?: string;
    otp?: string;
    city?: string;
    address?: string;
    state?: string;
    country?: string;
    zipcode?: number;
  };
}

export interface TokenizedChargeData {
  token: string;
  email: string;
  amount: number;
  tx_ref: string;
  currency?: string;
  narration: string;
}

export interface PaymentVerificationResponse {
  status: string;
  message: string;
  data?: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    processor_response: string;
    auth_model: string;
    payment_type: string;
    narration: string;
    status: string;
    account_id: number;
    customer: {
      id: number;
      name: string;
      phone_number: string;
      email: string;
    };
    card?: {
      first_6digits: string;
      last_4digits: string;
      issuer: string;
      country: string;
      type: string;
      token: string;
      expiry: string;
    };
  };
}

export interface ValidateChargeData {
  transaction_id: string;
  otp: string;
  type: 'card';
}

export interface CardBINResponse {
  status: string;
  message: string;
  data: {
    card_type: string;
    card_brand: string;
    card_issuer: string;
    card_issuer_info: {
      name: string;
      website: string;
      phone: string;
      email: string;
      address: string;
      country: string;
    };
    card_issuer_country: string;
    card_issuer_currency: string;
    card_issuer_currency_code: string;
    card_issuer_currency_symbol: string;
    card_issuer_currency_name: string;
    card_issuer_currency_decimal: number;
    card_issuer_currency_exchange_rate: number;
    card_issuer_currency_exchange_rate_date: string;
    card_issuer_currency_exchange_rate_source: string;
    card_issuer_currency_exchange_rate_updated_at: string;
  };
}