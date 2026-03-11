import {
    issueCertificate,
    type CertificateRegistryClient,
} from "../contracts/certificateRegistryClient.js";
import {
    prepareZkKycCertificateIssuance,
    type PreparedKycCertificateIssuance,
} from "../kyc/zkKyc.js";
import { loadGuardianRegistryContext } from "../runtime/guardianRegistryContext.js";
import { buildSponsoredSendOptions, type GuardianSendOptions } from "../tx/guardianTx.js";
import type {
    GuardianNetworkConfig,
    IssueKycCertificateOptions,
    IssueKycCertificateResult,
} from "../types.js";

interface IssueKycCertificateDependencies {
    network: GuardianNetworkConfig;
    account: {
        address: IssueKycCertificateResult["guardianAddress"];
    };
    paymentMethod: unknown;
    kyc: IssueKycCertificateOptions["kyc"];
    uniqueId?: IssueKycCertificateOptions["uniqueId"];
    revocationId?: IssueKycCertificateOptions["revocationId"];
    prepareIssuance(
        options: Pick<IssueKycCertificateOptions, "kyc" | "uniqueId" | "revocationId">
    ): Promise<PreparedKycCertificateIssuance>;
    submitIssuance(
        issuance: PreparedKycCertificateIssuance,
        sendOptions: GuardianSendOptions
    ): Promise<{ txHash: string }>;
}

/**
 * Issues a normalized ZK-KYC payload through injected dependencies so the call flow can be unit-tested.
 */
export async function issueKycCertificateFromDependencies(
    dependencies: IssueKycCertificateDependencies
): Promise<IssueKycCertificateResult> {
    const issuance = await dependencies.prepareIssuance({
        kyc: dependencies.kyc,
        uniqueId: dependencies.uniqueId,
        revocationId: dependencies.revocationId,
    });
    const sendOptions = buildSponsoredSendOptions(
        dependencies.account.address,
        dependencies.paymentMethod,
        dependencies.network
    );
    const receipt = await dependencies.submitIssuance(issuance, sendOptions);

    return {
        guardianAddress: dependencies.account.address,
        userAddress: issuance.userAddress,
        network: dependencies.network,
        uniqueId: issuance.uniqueId.toBigInt(),
        revocationId: issuance.revocationId.toBigInt(),
        txHash: receipt.txHash,
    };
}

/**
 * Loads the shared Aztec runtime, prepares the KYC payload, submits the issuance tx, and waits for settlement.
 */
export async function issueKycCertificate(
    options: IssueKycCertificateOptions
): Promise<IssueKycCertificateResult> {
    const context = await loadGuardianRegistryContext(options);

    return await issueKycCertificateFromDependencies({
        network: context.network,
        account: context.account,
        paymentMethod: context.paymentMethod,
        kyc: options.kyc,
        uniqueId: options.uniqueId,
        revocationId: options.revocationId,
        prepareIssuance: async (issuanceOptions) => await prepareZkKycCertificateIssuance(issuanceOptions),
        submitIssuance: async (issuance, sendOptions) =>
            await issueCertificate(context.certificateRegistryClient, issuance, sendOptions),
    });
}

export type { PreparedKycCertificateIssuance, CertificateRegistryClient };
