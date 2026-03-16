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
    userAddress: string;
    applicantId?: string;
    sumsubExternalUserId?: string;
    status: ProcessingStatus;
    normalizedKycPayload?: unknown;
    issuanceResult?: IssuanceResult;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
}

export function createProcessingRecord(
    id: string,
    userAddress: string,
    overrides?: Partial<Omit<ProcessingRecord, "id" | "userAddress" | "createdAt" | "updatedAt">>
): ProcessingRecord {
    const now = new Date().toISOString();
    return {
        id,
        userAddress,
        status: "accessTokenIssued",
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}
