import type {
    ChangeProfileDataDetailsRequest,
    GenerateAccessTokenResponse,
    GetApplicantDataResponse,
    ErrorResponse,
} from "./types.js";
import { sign } from "./sign.js";

const DEFAULT_BASE_URL = "https://api.sumsub.com";

export class SumsubError extends Error {
    constructor(
        message: string,
        public readonly code: number,
        public readonly correlationId?: string,
        public readonly errorCode?: number,
        public readonly errorName?: string
    ) {
        super(message);
        this.name = "SumsubError";
    }
}

export interface SumsubClientConfig {
    appToken: string;
    secretKey: string;
    baseUrl?: string;
}

/**
 * Sumsub API client: access tokens, applicant profile updates, applicant data.
 */
export class SumsubClient {
    private readonly token: string;
    private readonly secret: Uint8Array;
    private readonly baseUrl: string;

    constructor(config: SumsubClientConfig) {
        this.token = config.appToken;
        this.secret = new TextEncoder().encode(config.secretKey);
        this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    }

    /**
     * Generate an SDK access token for the given user and level.
     */
    async generateAccessToken(userId: string, levelName: string): Promise<GenerateAccessTokenResponse> {
        const uri = "/resources/accessTokens/sdk";
        const body = JSON.stringify({ userId, levelName });
        const res = await this.makeRequest("POST", uri, new TextEncoder().encode(body));
        return this.decodeResponse<GenerateAccessTokenResponse>(res);
    }

    /**
     * Update applicant profile data (e.g. metadata such as encryption_public_key).
     */
    async changeProfileDataDetails(
        applicantId: string,
        details: ChangeProfileDataDetailsRequest
    ): Promise<GetApplicantDataResponse> {
        const uri = "/resources/applicants/";
        const body = JSON.stringify({ id: applicantId, ...details });
        const res = await this.makeRequest("PATCH", uri, new TextEncoder().encode(body));
        return this.decodeResponse<GetApplicantDataResponse>(res);
    }

    /**
     * Fetch full applicant data by ID.
     */
    async getApplicantData(applicantId: string): Promise<GetApplicantDataResponse> {
        const uri = `/resources/applicants/${encodeURIComponent(applicantId)}/one`;
        const res = await this.makeRequest("GET", uri, null);
        return this.decodeResponse<GetApplicantDataResponse>(res);
    }

    private async makeRequest(
        method: string,
        uri: string,
        body: Uint8Array | null
    ): Promise<{ status: number; body: string }> {
        const url = `${this.baseUrl.replace(/\/$/, "")}${uri}`;
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const sig = sign(this.secret, timestamp, method, uri, body);

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-App-Token": this.token,
            "X-App-Access-Ts": timestamp,
            "X-App-Access-Sig": sig,
        };

        const res = await fetch(url, {
            method,
            headers,
            body: body ? Buffer.from(body) : undefined,
        });

        const text = await res.text();
        return { status: res.status, body: text };
    }

    private decodeResponse<T>(res: { status: number; body: string }): Promise<T> {
        if (res.status !== 200) {
            let err: ErrorResponse;
            try {
                err = JSON.parse(res.body) as ErrorResponse;
            } catch {
                throw new SumsubError(res.body || "Unknown error", res.status);
            }
            throw new SumsubError(
                err.description ?? "Sumsub API error",
                err.code ?? res.status,
                err.correlationId,
                err.errorCode,
                err.errorName
            );
        }
        try {
            return Promise.resolve(JSON.parse(res.body) as T);
        } catch (e) {
            throw new Error(`Failed to decode Sumsub response: ${e}`);
        }
    }
}
