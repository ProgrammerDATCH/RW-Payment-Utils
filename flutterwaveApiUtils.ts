import axios from 'axios';
import * as forge from 'node-forge';
import logger from '../config/logger';
import ApiError from './ApiError';
import httpStatus from 'http-status';
import { AuthorizationMode, CardPaymentData, FlutterwaveConfig, PaymentVerificationResponse, TokenizedChargeData, CardBINResponse } from './flutterwave';


class FlutterwaveApiService {
  private config: FlutterwaveConfig;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor() {
    const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    const encryptionKey = process.env.FLUTTERWAVE_ENCRYPTION_KEY;
    const redirectUrl = process.env.FLUTTERWAVE_REDIRECT_URL;

    if (!publicKey || !secretKey || !encryptionKey || !redirectUrl) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Flutterwave configuration is incomplete'
      );
    }

    this.config = {
      publicKey,
      secretKey,
      encryptionKey,
      redirectUrl,
      isTestMode: process.env.FLUTTERWAVE_TEST_MODE === 'true'
    };

    this.baseUrl = 'https://api.flutterwave.com/v3';
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.secretKey}`
    };
  }

  private encryptCardData(payload: any): string {
    const text = JSON.stringify(payload);
    const cipher = forge.cipher.createCipher(
      '3DES-ECB',
      forge.util.createBuffer(this.config.encryptionKey)
    );
    cipher.start({ iv: '' });
    cipher.update(forge.util.createBuffer(text));
    cipher.finish();
    const encrypted = cipher.output;
    return forge.util.encode64(encrypted.getBytes());
  }

  /**
   * Charge card with option for pre-authorization
   */
  async chargeCard(data: CardPaymentData): Promise<any> {
    try {
      const cardData: any = {
        card_number: data.card_number,
        cvv: data.cvv,
        expiry_month: data.expiry_month,
        expiry_year: data.expiry_year,
        email: data.email,
        currency: data.currency || 'RWF',
        amount: data.amount.toString(),
        tx_ref: data.tx_ref,
        fullname: data.fullname,
        redirect_url: process.env.FLUTTERWAVE_REDIRECT_URL,
        payment_type: 'card',
        preauthorize: data.preauthorize,
        // "usesecureauth": true,
        device_fingerprint: "device_fingerprint",
        client_ip: "127.0.0.1"
      };

      // Add authorization details if provided
      if (data.authorization) {
        cardData.authorization = {
          mode: data.authorization.mode.toLocaleLowerCase(),
        };

        if (data.authorization.mode === AuthorizationMode.PIN && data.authorization.pin) {
          cardData.authorization.pin = data.authorization.pin;
        }

        if (data.authorization.mode === AuthorizationMode.OTP && data.authorization.otp) {
          cardData.authorization.otp = data.authorization.otp;
        }

        // Add additional authorization fields if available
        if (data.authorization.city) cardData.authorization.city = data.authorization.city;
        if (data.authorization.address) cardData.authorization.address = data.authorization.address;
        if (data.authorization.state) cardData.authorization.state = data.authorization.state;
        if (data.authorization.country) cardData.authorization.country = data.authorization.country;
        if (data.authorization.zipcode) cardData.authorization.zipcode = data.authorization.zipcode;
      }

      const encryptedData = this.encryptCardData(cardData);

      const payload = {
        client: encryptedData,
        client_ip: cardData.client_ip,
        device_fingerprint: cardData.device_fingerprint,
        alg: "3DES-24"
      };

      const response = await axios.post(
        `${this.baseUrl}/charges?type=card`,
        payload,
        { headers: this.headers }
      );

      if (response.data.status === 'error') {
        throw new ApiError(httpStatus.BAD_REQUEST, response.data.message);
      }

      // If preauthorize is true and we get a pending status, we need to validate the charge
      if (data.preauthorize && response.data.data?.status === 'pending') {
        const authMode = response.data.meta?.authorization?.mode;
        if (authMode) {
          logger.info(`Preauthorization requires ${authMode} validation`);
          // The charge needs to be validated using validateCharge method
          // The flw_ref will be in response.data.data.flw_ref
          return {
            ...response.data,
            requires_validation: true,
            validation_mode: authMode,
            flw_ref: response.data.data.flw_ref
          };
        }
      }

      return response.data;
    } catch (error: any) {
      logger.error('Flutterwave card charge failed:', error.response?.data || error.message);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        error.response?.data?.message || error.message || 'Card charge failed'
      );
    }
  }

  /**
   * Charge with saved card token
   */
  async chargeWithToken(data: TokenizedChargeData): Promise<any> {
    try {
      const payload = {
        token: data.token,
        currency: data.currency || 'RWF',
        amount: data.amount.toString(),
        email: data.email,
        tx_ref: data.tx_ref,
        redirect_url: this.config.redirectUrl,
      };

      const response = await axios.post(
        `${this.baseUrl}/tokenized-charges`,
        payload,
        { headers: this.headers }
      );

      if (response.data.status === 'error') {
        throw new ApiError(httpStatus.BAD_REQUEST, response.data.message);
      }

      return response.data;
    } catch (error: any) {
      logger.error('Flutterwave tokenized charge failed:', error.response?.data || error.message);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        error.response?.data?.message || error.message || 'Tokenized charge failed'
      );
    }
  }

  async validateCharge(flw_ref: string, otp: string, type: 'card' | 'account' = 'card'): Promise<any> {
    try {
      const payload = {
        otp,
        flw_ref,
        type
      };

      const response = await axios.post(
        `${this.baseUrl}/validate-charge`,
        payload,
        { headers: this.headers }
      );

      if (response.data.status === 'error') {
        throw new ApiError(httpStatus.BAD_REQUEST, response.data.message);
      }

      return response.data;
    } catch (error: any) {
      logger.error('Flutterwave charge validation failed:', error.response?.data || error.message);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        error.response?.data?.message || error.message || 'Charge validation failed'
      );
    }
  }

  /**
   * Get card BIN information
   */
  async getCardBIN(cardNumber: string): Promise<CardBINResponse> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/card-bins/${cardNumber}`,
        { headers: this.headers }
      );

      if (response.data.status === 'error') {
        throw new ApiError(httpStatus.BAD_REQUEST, response.data.message);
      }

      return response.data;
    } catch (error: any) {
      logger.error('Flutterwave card BIN lookup failed:', error.response?.data || error.message);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        error.response?.data?.message || error.message || 'Card BIN lookup failed'
      );
    }
  }

  /**
   * Verify payment transaction
   */
  async verifyPayment(transactionId: string): Promise<PaymentVerificationResponse> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transactions/${transactionId}/verify`,
        { headers: this.headers }
      );

      if (response.data.status === 'error') {
        throw new ApiError(httpStatus.BAD_REQUEST, response.data.message);
      }

      return response.data;
    } catch (error: any) {
      logger.error('Flutterwave payment verification failed:', error.response?.data || error.message);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        error.response?.data?.message || error.message || 'Payment verification failed'
      );
    }
  }

  /**
   * Void a pre-authorized transaction
   */
  async voidPreauthorization(transactionId: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/charges/${transactionId}/void`,
        {},
        { headers: this.headers }
      );

      if (response.data.status === 'error') {
        throw new ApiError(httpStatus.BAD_REQUEST, response.data.message);
      }

      return response.data;
    } catch (error: any) {
      logger.error('Flutterwave void preauthorization failed:', error.response?.data || error.message);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        error.response?.data?.message || error.message || 'Void preauthorization failed'
      );
    }
  }
}

export const flutterwaveApiService = new FlutterwaveApiService(); 