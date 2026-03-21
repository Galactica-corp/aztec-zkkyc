import type { ApplicantReviewed } from "./types.js";
import { SumsubClient } from "./client.js";
import { verifyWebhookDigest } from "./webhookDigest.js";
import { logWebhookPayloadSummary } from "./webhookDebug.js";
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

        async handleWebhook(
            expectedDigest: Uint8Array,
            digestAlgorithm: string,
            body: Uint8Array
        ): Promise<void> {
            console.log("[webhook] Verifying digest: alg=%s, bodyLength=%d", digestAlgorithm, body.length);
            const valid = verifyWebhookDigest(webhookSecret, expectedDigest, digestAlgorithm, body);
            if (!valid) {
                console.log("[webhook] Digest verification FAILED (check SUMSUB_WEBHOOK_SECRET_KEY)");
                throw new Error("invalid digest");
            }
            console.log("[webhook] Digest OK");
            const envelope = JSON.parse(new TextDecoder().decode(body)) as { type?: string };
            logWebhookPayloadSummary(envelope);
            console.log("[webhook] Event type: %s", envelope.type ?? "(missing)");
            if (envelope.type === "applicantReviewed") {
                const event = envelope as ApplicantReviewed;
                const answer = event.reviewResult?.reviewAnswer;
                console.log("[webhook] applicantReviewed reviewAnswer=%s", answer ?? "(missing)");
                if (event.reviewResult?.reviewAnswer === "GREEN" && onApplicantReviewed) {
                    console.log("[webhook] Calling onApplicantReviewed (issuance flow)");
                    await onApplicantReviewed(event);
                    console.log("[webhook] onApplicantReviewed completed");
                }
            }
        },
    };
}
