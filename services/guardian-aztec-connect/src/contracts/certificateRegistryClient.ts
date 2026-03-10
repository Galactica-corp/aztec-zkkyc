import { Contract } from "@aztec/aztec.js/contracts";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import * as dotenv from "dotenv";
import path from "path";
import { loadGuardianRuntime } from "../runtime/guardianRuntime.js";
import type {
    CertificateRegistrySetupOptions,
    GuardianRuntime,
    GuardianWalletSetupOptions,
} from "../types.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

export type CertificateRegistryContractInstance = Awaited<ReturnType<typeof Contract.at>>;

export interface CertificateRegistryClient {
    address: AztecAddress;
    runtime: GuardianRuntime;
    contract: CertificateRegistryContractInstance;
}

export interface CertificateRegistryClientDependencies {
    loadContract(
        address: AztecAddress,
        runtime: GuardianRuntime
    ): Promise<CertificateRegistryContractInstance>;
}

const defaultDependencies: CertificateRegistryClientDependencies = {
    async loadContract(address, runtime) {
        const artifactModulePath = new URL("../../../../artifacts/CertificateRegistry.js", import.meta.url).href;
        const { CertificateRegistryContract } = await import(artifactModulePath);
        return await Contract.at(address, CertificateRegistryContract.artifact, runtime.wallet);
    },
};

export function resolveCertificateRegistryAddress(
    options: CertificateRegistrySetupOptions = {},
    env: NodeJS.ProcessEnv = process.env
): AztecAddress {
    const configuredAddress = options.certificateRegistryAddress ?? env.CERTIFICATE_REGISTRY_ADDRESS;
    if (!configuredAddress) {
        throw new Error("CERTIFICATE_REGISTRY_ADDRESS environment variable is required");
    }

    return typeof configuredAddress === "string"
        ? AztecAddress.fromString(configuredAddress)
        : configuredAddress;
}

export async function createCertificateRegistryClientFromRuntime(
    runtime: GuardianRuntime,
    options: CertificateRegistrySetupOptions = {},
    dependencies: CertificateRegistryClientDependencies = defaultDependencies
): Promise<CertificateRegistryClient> {
    const address = resolveCertificateRegistryAddress(options);
    const contract = await dependencies.loadContract(address, runtime);

    return {
        address,
        runtime,
        contract,
    };
}

export async function loadCertificateRegistryClient(
    options: GuardianWalletSetupOptions & CertificateRegistrySetupOptions = {},
    dependencies: CertificateRegistryClientDependencies = defaultDependencies
): Promise<CertificateRegistryClient> {
    const runtime = await loadGuardianRuntime(options);
    return await createCertificateRegistryClientFromRuntime(runtime, options, dependencies);
}
