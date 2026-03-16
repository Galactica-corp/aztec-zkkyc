import type { ApplicantReviewed } from "../../src/sumsub/types.js";
import { createSumsubKycService } from "../../src/sumsub/sumsubKycService.js";

describe("createSumsubKycService", () => {
    const secret = "SoMe_SeCrEt_KeY";
    const opts = {
        appToken: "token",
        secretKey: secret,
        webhookSecretKey: secret,
    };

    describe("handleWebhook", () => {
        it("throws when digest is invalid", async () => {
            const service = createSumsubKycService(opts);
            const body = new TextEncoder().encode('{"type":"applicantReviewed"}');
            const wrongDigest = new Uint8Array(32);
            await expect(
                service.handleWebhook(wrongDigest, "HMAC_SHA256_HEX", body)
            ).rejects.toThrow("invalid digest");
        });

        it("calls onApplicantReviewed when digest is valid and reviewAnswer is GREEN", async () => {
            const payload = {
                type: "applicantReviewed",
                applicantId: "app-1",
                externalUserId: "holder-1",
                reviewResult: { reviewAnswer: "GREEN" as const },
            };
            const bodyBytes = new TextEncoder().encode(JSON.stringify(payload));
            const { createHmac } = await import("node:crypto");
            const h = createHmac("sha256", secret);
            h.update(Buffer.from(bodyBytes));
            const expectedDigest = new Uint8Array(h.digest());

            let called: ApplicantReviewed | null = null;
            const service = createSumsubKycService({
                ...opts,
                onApplicantReviewed: (p) => {
                    called = p;
                },
            });
            await service.handleWebhook(expectedDigest, "HMAC_SHA256_HEX", bodyBytes);
            expect(called).not.toBeNull();
            expect(called!.applicantId).toBe("app-1");
            expect(called!.externalUserId).toBe("holder-1");
            expect(called!.reviewResult.reviewAnswer).toBe("GREEN");
        });

        it("does not call onApplicantReviewed when reviewAnswer is RED", async () => {
            const payload = {
                type: "applicantReviewed",
                applicantId: "app-2",
                externalUserId: "holder-2",
                reviewResult: { reviewAnswer: "RED" as const },
            };
            const body = new TextEncoder().encode(JSON.stringify(payload));
            const { createHmac } = await import("node:crypto");
            const h = createHmac("sha256", secret);
            h.update(body);
            const expectedDigest = new Uint8Array(h.digest());
            let called = false;
            const service = createSumsubKycService({
                ...opts,
                onApplicantReviewed: () => {
                    called = true;
                },
            });
            await service.handleWebhook(expectedDigest, "HMAC_SHA256_HEX", body);
            expect(called).toBe(false);
        });
    });
});
