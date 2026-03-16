import type { ApplicantReviewed } from "./types.js";
import { SumsubClient } from "./client.js";
import { verifyWebhookDigest } from "./webhookDigest.js";
import type { KYCService } from "../domain/kycService.js";

const LEVEL_NAME = "id-only";

export type ApplicantReviewedHandler = (payload: ApplicantReviewed) => void | Promise<void>;

export interface SumsubKycServiceOptions {
    appToken: string;
    secretKey: string;
    webhookSecretKey: string;
    baseUrl?: string;
    onApplicantReviewed?: ApplicantReviewedHandler;
}

/**
 * KYC service implementation using Sumsub API and webhook digest verification.
 */
export function createSumsubKycService(options: SumsubKycServiceOptions): KYCService {
    const client = new SumsubClient({
        appToken: options.appToken,
        secretKey: options.secretKey,
        baseUrl: options.baseUrl,
    });
    const webhookSecret = new TextEncoder().encode(options.webhookSecretKey);
    const onApplicantReviewed = options.onApplicantReviewed;

    return {
        async generateAccessToken(userId: string): Promise<string> {
            const res = await client.generateAccessToken(userId, LEVEL_NAME);
            return res.token;
        },

        async attachEncryptionPublicKey(
            applicantId: string,
            encryptionPublicKey: Uint8Array | string
        ): Promise<void> {
            const bytes =
                typeof encryptionPublicKey === "string"
                    ? Buffer.from(encryptionPublicKey, "base64")
                    : encryptionPublicKey;
            const value = Buffer.from(bytes).toString("base64");
            await client.changeProfileDataDetails(applicantId, {
                metadata: [{ key: "encryption_public_key", value }],
            });
        },

        async handleWebhook(
            expectedDigest: Uint8Array,
            digestAlgorithm: string,
            body: Uint8Array
        ): Promise<void> {
            if (!verifyWebhookDigest(webhookSecret, expectedDigest, digestAlgorithm, body)) {
                throw new Error("invalid digest");
            }
            const envelope = JSON.parse(new TextDecoder().decode(body)) as { type?: string };
            if (envelope.type === "applicantReviewed") {
                const event = JSON.parse(new TextDecoder().decode(body)) as ApplicantReviewed;
                if (event.reviewResult?.reviewAnswer === "GREEN" && onApplicantReviewed) {
                    await onApplicantReviewed(event);
                }
            }
        },
    };
}
