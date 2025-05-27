import axios from 'axios';
import logger from '../config/logger';
import ApiError from './ApiError';
import httpStatus from 'http-status';

export interface MomoConfig {
    baseUrl: string;
    primaryKey: string;
    username: string;
    password: string;
    env: string;
}

export interface MomoPaymentRequest {
    amount: number;
    currency: string;
    externalId: string;
    payer: {
        partyIdType: string;
        partyId: string;
    };
    payerMessage: string;
    payeeNote: string;
}

export interface MomoTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

export interface MomoPaymentResponse {
    amount: string;
    currency: string;
    financialTransactionId: string;
    externalId: string;
    payer: {
        partyIdType: string;
        partyId: string;
    };
    status: "SUCCESSFUL" | "FAILED" | "PENDING";
    reason?: string;
}

class MomoService {
    private config: MomoConfig;

    constructor() {
        this.config = {
            baseUrl: process.env.MOMO_BASE_URL || 'https://proxy.momoapi.mtn.co.rw/collection',
            primaryKey: process.env.MOMO_PRIMARY_KEY || '',
            username: process.env.MOMO_USERNAME || '',
            password: process.env.MOMO_PASSWORD || '',
            env: process.env.MOMO_ENV || 'mtnrwanda'
        };

        this.validateConfig();
    }

    private validateConfig(): void {
        if (!this.config.primaryKey || !this.config.username || !this.config.password) {
            throw new ApiError(
                httpStatus.INTERNAL_SERVER_ERROR,
                'MTN MOMO configuration is incomplete'
            );
        }
    }

    private getHeaders(token?: string): Record<string, string> {
        const headers: Record<string, string> = {
            'Ocp-Apim-Subscription-Key': this.config.primaryKey
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            headers['X-Target-Environment'] = this.config.env;
        }

        return headers;
    }

    async generateToken(): Promise<MomoTokenResponse> {
        try {
            const response = await axios.post(
                `${this.config.baseUrl}/token/`,
                null,
                {
                    auth: {
                        username: this.config.username,
                        password: this.config.password
                    },
                    headers: this.getHeaders()
                }
            );
            return response.data;
        } catch (error: any) {
            logger.error('MOMO token generation failed:', error.response?.data || error.message);
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                error.response?.data?.message || 'Token generation failed'
            );
        }
    }

    async requestPayment(
        amount: number,
        phoneNumber: string,
        externalId: string,
        externalReference: string,
        payerMessage?: string,
        payeeNote?: string
    ): Promise<{ referenceId: string }> {
        try {
            const tokenResponse = await this.generateToken();
            const requestData: MomoPaymentRequest = {
                amount: amount,
                currency: this.config.env === "sandbox" ? "EUR" : "RWF",
                externalId: externalId,
                payer: {
                    partyIdType: "MSISDN",
                    partyId: phoneNumber.replace("+", "")
                },
                payerMessage: payerMessage || "",
                payeeNote: payeeNote || ""
            };

            await axios.post(
                `${this.config.baseUrl}/v1_0/requesttopay`,
                requestData,
                {
                    headers: {
                        ...this.getHeaders(tokenResponse.access_token),
                        'X-Reference-Id': externalReference,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return { referenceId: externalReference };
        } catch (error: any) {
            logger.error('MOMO payment request failed:', error.response?.data || error.message);
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                error.response?.data?.message || 'Payment request failed'
            );
        }
    }

    async checkPaymentStatus(referenceId: string): Promise<MomoPaymentResponse> {
        try {
            const tokenResponse = await this.generateToken();
            const response = await axios.get(
                `${this.config.baseUrl}/v1_0/requesttopay/${referenceId}`,
                {
                    headers: this.getHeaders(tokenResponse.access_token)
                }
            );
            return response.data;
        } catch (error: any) {
            logger.error('MOMO payment status check failed:', error.response?.data || error.message);
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                error.response?.data?.message || 'Payment status check failed'
            );
        }
    }
}

export const momoService = new MomoService(); 