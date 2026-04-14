import { revokeCertificateByRevocationId } from "../contracts/certificateRegistryClient.js";
import { loadGuardianRegistryContext } from "../runtime/guardianRegistryContext.js";
import { buildGuardianSendOptions, type GuardianSendOptions } from "../tx/guardianTx.js";
import type {
    GuardianNetworkConfig,
    RevokeCertificateOptions,
    RevokeCertificateResult,
} from "../types.js";

interface RevokeCertificateDependencies {
    network: GuardianNetworkConfig;
    account: {
        address: RevokeCertificateResult["guardianAddress"];
    };
    paymentMethod?: unknown;
    revocationId: RevokeCertificateOptions["revocationId"];
    submitRevocation(
        revocationId: RevokeCertificateOptions["revocationId"],
        sendOptions: GuardianSendOptions
    ): Promise<{ txHash: string }>;
}

function normalizeRevocationId(revocationId: RevokeCertificateOptions["revocationId"]): bigint {
    return BigInt(revocationId.toString());
}

/**
 * Submits certificate revocation through injected dependencies so the call flow can be unit-tested.
 */
export async function revokeCertificateFromDependencies(
    dependencies: RevokeCertificateDependencies
): Promise<RevokeCertificateResult> {
    const sendOptions = buildGuardianSendOptions(
        dependencies.account.address,
        dependencies.paymentMethod,
        dependencies.network
    );
    const receipt = await dependencies.submitRevocation(dependencies.revocationId, sendOptions);

    return {
        guardianAddress: dependencies.account.address,
        network: dependencies.network,
        revocationId: normalizeRevocationId(dependencies.revocationId),
        txHash: receipt.txHash,
    };
}

/**
 * Loads the shared Aztec runtime, submits a certificate revocation tx, and waits for settlement.
 */
export async function revokeCertificate(
    options: RevokeCertificateOptions
): Promise<RevokeCertificateResult> {
    const context = await loadGuardianRegistryContext(options);

    return await revokeCertificateFromDependencies({
        network: context.network,
        account: context.account,
        paymentMethod: context.paymentMethod,
        revocationId: options.revocationId,
        submitRevocation: async (revocationId, sendOptions) =>
            await revokeCertificateByRevocationId(context.certificateRegistryClient, revocationId, sendOptions),
    });
}
