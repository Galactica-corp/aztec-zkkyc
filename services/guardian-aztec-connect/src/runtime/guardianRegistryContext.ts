import {
    createCertificateRegistryClientFromRuntime,
    type CertificateRegistryClient,
} from "../contracts/certificateRegistryClient.js";
import { loadSponsoredGuardianRuntime, type GuardianRuntimeWithFees } from "./guardianRuntime.js";
import type { GuardianStatusOptions } from "../types.js";

export interface GuardianRegistryContext extends GuardianRuntimeWithFees {
    certificateRegistryClient: CertificateRegistryClient;
}

/**
 * Loads the sponsored guardian runtime together with a ready-to-use certificate registry client.
 */
export async function loadGuardianRegistryContext(
    options: GuardianStatusOptions = {}
): Promise<GuardianRegistryContext> {
    const runtime = await loadSponsoredGuardianRuntime(options);
    const certificateRegistryClient = await createCertificateRegistryClientFromRuntime(runtime, options);

    return {
        ...runtime,
        certificateRegistryClient,
    };
}
