import type { ProcessingRecord, ProcessingStatus } from "./processingRecord.js";

/**
 * Repository for KYC processing records. Supports in-memory and future Redis-backed implementations.
 */
export interface ProcessingRepository {
    save(record: ProcessingRecord): Promise<void>;
    getById(id: string): Promise<ProcessingRecord | null>;
    getByApplicantId(applicantId: string): Promise<ProcessingRecord | null>;
    getByHolderCommitment(holderCommitment: string): Promise<ProcessingRecord | null>;
    updateStatus(
        id: string,
        status: ProcessingStatus,
        updates?: Partial<Pick<ProcessingRecord, "applicantId" | "sumsubExternalUserId" | "userAddress" | "normalizedKycPayload" | "issuanceResult" | "lastError">>
    ): Promise<void>;
}
