import type { ProcessingRepository } from "./processingRepository.js";
import type { GetApplicantDataResponse } from "../sumsub/types.js";
import { logApplicantDataForWebhook } from "../sumsub/webhookDebug.js";
import type { NormalizedZkKyc } from "./normalizedZkKyc.js";
import { normalizeSumsubToZkKyc } from "./normalizeSumsubToZkKyc.js";

export interface IssuanceResult {
    uniqueId: bigint;
    revocationId: bigint;
    txHash: string;
}

export interface IssuanceRunnerDeps {
    getApplicantData: (applicantId: string) => Promise<GetApplicantDataResponse>;
    repository: ProcessingRepository;
    /** Optional: inject for tests; defaults to guardianAztecAdapter.issue + runPreflight */
    issue?: (kyc: NormalizedZkKyc) => Promise<IssuanceResult>;
    runPreflight?: () => Promise<unknown>;
}

/**
 * Runs the full issuance flow for an approved applicant: load record, fetch applicant, normalize, preflight, issue, persist.
 * Idempotent: if record is already issued, no-op. Fails clearly when userAddress is missing.
 */
export function createIssuanceRunner(deps: IssuanceRunnerDeps) {
    return {
        async run(applicantId: string): Promise<void> {
            const record = await deps.repository.getByApplicantId(applicantId);
            if (!record) return;
            if (record.status === "issued") return;

            const userAddress = record.userAddress;
            if (!userAddress?.trim()) {
                await deps.repository.updateStatus(record.id, "failed", {
                    lastError: "userAddress is required for issuance; frontend must send it with the access-token request",
                });
                return;
            }

            await deps.repository.updateStatus(record.id, "issuing");

            const doPreflight =
                deps.runPreflight ??
                (async () => {
                    const { runPreflight } = await import("../aztec/guardianAztecAdapter.js");
                    return runPreflight();
                });
            const doIssue =
                deps.issue ??
                (async (kyc: NormalizedZkKyc) => {
                    const { guardianAztecAdapter } = await import("../aztec/guardianAztecAdapter.js");
                    return guardianAztecAdapter.issue(kyc);
                });

            try {
                await doPreflight();
                const applicant = await deps.getApplicantData(applicantId);
                logApplicantDataForWebhook(applicant);
                const normalized = normalizeSumsubToZkKyc(applicant, userAddress);
                const result = await doIssue(normalized);
                await deps.repository.updateStatus(record.id, "issued", {
                    issuanceResult: {
                        uniqueId: result.uniqueId,
                        revocationId: result.revocationId,
                        txHash: result.txHash,
                    },
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                await deps.repository.updateStatus(record.id, "failed", { lastError: message });
                throw err;
            }
        },
    };
}
