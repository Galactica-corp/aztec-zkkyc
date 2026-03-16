import type { ProcessingRepository } from "./processingRepository.js";
import { createProcessingRecord } from "./processingRecord.js";
import { randomUUID } from "node:crypto";

/**
 * Handles approved KYC events: ensures a processing record exists and advances status.
 * Idempotent: if the applicant is already issued, no-op.
 */
export interface IssuanceWorkflow {
    processApprovedApplicant(applicantId: string, externalUserId: string): Promise<void>;
}

export function createIssuanceWorkflow(repository: ProcessingRepository): IssuanceWorkflow {
    return {
        async processApprovedApplicant(applicantId: string, externalUserId: string): Promise<void> {
            const existing = await repository.getByApplicantId(applicantId);
            if (existing) {
                if (existing.status === "issued") return;
                await repository.updateStatus(existing.id, "approved", {
                    applicantId,
                    sumsubExternalUserId: externalUserId,
                });
                return;
            }
            const byUser = await repository.getByUserAddress(externalUserId);
            if (byUser) {
                if (byUser.status === "issued") return;
                await repository.updateStatus(byUser.id, "approved", {
                    applicantId,
                    sumsubExternalUserId: externalUserId,
                });
                return;
            }
            const record = createProcessingRecord(randomUUID(), externalUserId, {
                applicantId,
                sumsubExternalUserId: externalUserId,
                status: "approved",
            });
            await repository.save(record);
        },
    };
}
