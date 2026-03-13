import { listGuardianCertificateCopies } from "../contracts/certificateRegistryClient.js";
import { loadGuardianRegistryContext } from "../runtime/guardianRegistryContext.js";
import type {
    GuardianNetworkConfig,
    GuardianStatusOptions,
    ListRevokableCertificatesResult,
    RevokableCertificateSummary,
} from "../types.js";

interface ListRevokableCertificatesDependencies {
    network: GuardianNetworkConfig;
    guardianAddress: ListRevokableCertificatesResult["guardianAddress"];
    listCertificates(): Promise<{
        count: number;
        certificates: RevokableCertificateSummary[];
    }>;
}

/**
 * Maps an injected guardian certificate-copy query into the public SDK result shape.
 */
export async function listRevokableCertificatesFromDependencies(
    dependencies: ListRevokableCertificatesDependencies
): Promise<ListRevokableCertificatesResult> {
    const listedCertificates = await dependencies.listCertificates();

    return {
        guardianAddress: dependencies.guardianAddress,
        network: dependencies.network,
        count: listedCertificates.count,
        certificates: listedCertificates.certificates,
    };
}

/**
 * Lists the guardian-held certificate copies and their revocation IDs from the certificate registry.
 */
export async function listRevokableCertificates(
    options: GuardianStatusOptions = {}
): Promise<ListRevokableCertificatesResult> {
    const context = await loadGuardianRegistryContext(options);

    return await listRevokableCertificatesFromDependencies({
        network: context.network,
        guardianAddress: context.account.address,
        listCertificates: async () =>
            await listGuardianCertificateCopies(context.certificateRegistryClient, context.account.address),
    });
}
