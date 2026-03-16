/**
 * Internal processing record that bridges frontend session, Sumsub, and Aztec issuance.
 * See AGENTS.md migration spec.
 */
export type ProcessingStatus =
    | "accessTokenIssued"
    | "applicantLoaded"
    | "approved"
    | "issuing"
    | "issued"
    | "failed";

export interface IssuanceResult {
    uniqueId: bigint;
    revocationId: bigint;
    txHash: string;
}

export interface ProcessingRecord {
    id: string;
    holderCommitment: string;
    userAddress?: string;
    applicantId?: string;
    sumsubExternalUserId?: string;
    encryptionPublicKey?: string;
    status: ProcessingStatus;
    normalizedKycPayload?: unknown;
    issuanceResult?: IssuanceResult;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
}

export function createProcessingRecord(
    id: string,
    holderCommitment: string,
    overrides?: Partial<Omit<ProcessingRecord, "id" | "holderCommitment" | "createdAt" | "updatedAt">>
): ProcessingRecord {
    const now = new Date().toISOString();
    return {
        id,
        holderCommitment,
        status: "accessTokenIssued",
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}
