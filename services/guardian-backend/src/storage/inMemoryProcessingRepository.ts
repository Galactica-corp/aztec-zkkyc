import type { ProcessingRecord, ProcessingStatus } from "../domain/processingRecord.js";
import type { ProcessingRepository } from "../domain/processingRepository.js";

/**
 * In-memory implementation of ProcessingRepository for tests and local development.
 */
export class InMemoryProcessingRepository implements ProcessingRepository {
    private readonly byId = new Map<string, ProcessingRecord>();
    private readonly byApplicantId = new Map<string, string>();
    private readonly byHolderCommitment = new Map<string, string>();

    async save(record: ProcessingRecord): Promise<void> {
        const copy = { ...record, updatedAt: new Date().toISOString() };
        this.byId.set(record.id, copy);
        if (record.applicantId) this.byApplicantId.set(record.applicantId, record.id);
        this.byHolderCommitment.set(record.holderCommitment, record.id);
    }

    async getById(id: string): Promise<ProcessingRecord | null> {
        return this.byId.get(id) ?? null;
    }

    async getByApplicantId(applicantId: string): Promise<ProcessingRecord | null> {
        const id = this.byApplicantId.get(applicantId);
        return id ? this.byId.get(id) ?? null : null;
    }

    async getByHolderCommitment(holderCommitment: string): Promise<ProcessingRecord | null> {
        const id = this.byHolderCommitment.get(holderCommitment);
        return id ? this.byId.get(id) ?? null : null;
    }

    async updateStatus(
        id: string,
        status: ProcessingStatus,
        updates?: Partial<Pick<ProcessingRecord, "applicantId" | "sumsubExternalUserId" | "userAddress" | "normalizedKycPayload" | "issuanceResult" | "lastError">>
    ): Promise<void> {
        const record = this.byId.get(id);
        if (!record) return;
        const updated: ProcessingRecord = {
            ...record,
            status,
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.byId.set(id, updated);
        if (updates?.applicantId) this.byApplicantId.set(updates.applicantId, id);
    }
}
