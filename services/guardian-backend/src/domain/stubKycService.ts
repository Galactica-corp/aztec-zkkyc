import type { KYCService } from "./kycService.js";

/**
 * Stub KYC service for tests and local dev without Sumsub. Returns a fake token and no-ops for key/webhook.
 */
export const stubKycService: KYCService = {
    async generateAccessToken(): Promise<string> {
        return "stub-access-token";
    },
    async handleWebhook(): Promise<void> {
        // no-op; real implementation will verify digest and dispatch
    },
};
