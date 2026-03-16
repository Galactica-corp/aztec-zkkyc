import {
    getGuardianAccountStatus,
    deployGuardianAccountIfNeeded,
    issueKycCertificate,
    revokeCertificate,
    listRevokableCertificates,
} from "@galactica-net/guardian-aztec-connect";
import type {
    GuardianAccountStatus,
    DeployGuardianAccountResult,
    IssueKycCertificateResult,
    ListRevokableCertificatesResult,
    RevokeCertificateResult,
    ZkKycInput,
} from "@galactica-net/guardian-aztec-connect";

export type { GuardianAccountStatus, DeployGuardianAccountResult, IssueKycCertificateResult, ListRevokableCertificatesResult, RevokeCertificateResult };

/**
 * Options for the Aztec adapter, typically from environment variables.
 */
export interface GuardianAztecAdapterOptions {
    aztecEnv?: string;
    certificateRegistryAddress?: string;
    certificateRegistryAdminAddress?: string;
    certificateRegistryDeploymentSalt?: string;
    certificateRegistryDeployerAddress?: string;
}

function getOptions(overrides?: GuardianAztecAdapterOptions): GuardianAztecAdapterOptions {
    return {
        aztecEnv: process.env.AZTEC_ENV ?? "local-network",
        certificateRegistryAddress: process.env.CERTIFICATE_REGISTRY_ADDRESS,
        certificateRegistryAdminAddress: process.env.CERTIFICATE_REGISTRY_ADMIN_ADDRESS,
        certificateRegistryDeploymentSalt: process.env.CERTIFICATE_REGISTRY_DEPLOYMENT_SALT,
        certificateRegistryDeployerAddress: process.env.CERTIFICATE_REGISTRY_DEPLOYER_ADDRESS,
        ...overrides,
    };
}

/**
 * Thin adapter around guardian-aztec-connect for status, deployment, issuance, and revocation.
 */
export const guardianAztecAdapter = {
    async getStatus(overrides?: GuardianAztecAdapterOptions): Promise<GuardianAccountStatus> {
        const opts = getOptions(overrides);
        return getGuardianAccountStatus({
            aztecEnv: opts.aztecEnv,
            certificateRegistryAddress: opts.certificateRegistryAddress,
            certificateRegistryAdminAddress: opts.certificateRegistryAdminAddress,
            certificateRegistryDeploymentSalt: opts.certificateRegistryDeploymentSalt,
            certificateRegistryDeployerAddress: opts.certificateRegistryDeployerAddress,
        });
    },

    async deployIfNeeded(overrides?: GuardianAztecAdapterOptions): Promise<DeployGuardianAccountResult> {
        const opts = getOptions(overrides);
        return deployGuardianAccountIfNeeded({
            aztecEnv: opts.aztecEnv,
            certificateRegistryAddress: opts.certificateRegistryAddress,
            certificateRegistryAdminAddress: opts.certificateRegistryAdminAddress,
            certificateRegistryDeploymentSalt: opts.certificateRegistryDeploymentSalt,
            certificateRegistryDeployerAddress: opts.certificateRegistryDeployerAddress,
        });
    },

    async issue(kyc: ZkKycInput, overrides?: GuardianAztecAdapterOptions): Promise<IssueKycCertificateResult> {
        const opts = getOptions(overrides);
        return issueKycCertificate({
            aztecEnv: opts.aztecEnv,
            kyc,
            certificateRegistryAddress: opts.certificateRegistryAddress,
            certificateRegistryAdminAddress: opts.certificateRegistryAdminAddress,
            certificateRegistryDeploymentSalt: opts.certificateRegistryDeploymentSalt,
            certificateRegistryDeployerAddress: opts.certificateRegistryDeployerAddress,
        });
    },

    async revoke(revocationId: bigint | number | string, overrides?: GuardianAztecAdapterOptions): Promise<RevokeCertificateResult> {
        const opts = getOptions(overrides);
        return revokeCertificate({
            aztecEnv: opts.aztecEnv,
            revocationId,
            certificateRegistryAddress: opts.certificateRegistryAddress,
            certificateRegistryAdminAddress: opts.certificateRegistryAdminAddress,
            certificateRegistryDeploymentSalt: opts.certificateRegistryDeploymentSalt,
            certificateRegistryDeployerAddress: opts.certificateRegistryDeployerAddress,
        });
    },

    async listRevokable(overrides?: GuardianAztecAdapterOptions): Promise<ListRevokableCertificatesResult> {
        const opts = getOptions(overrides);
        return listRevokableCertificates({
            aztecEnv: opts.aztecEnv,
            certificateRegistryAddress: opts.certificateRegistryAddress,
            certificateRegistryAdminAddress: opts.certificateRegistryAdminAddress,
            certificateRegistryDeploymentSalt: opts.certificateRegistryDeploymentSalt,
            certificateRegistryDeployerAddress: opts.certificateRegistryDeployerAddress,
        });
    },
};

/**
 * Run preflight checks: guardian account status and optional deploy. Throws if registry config missing or guardian not ready.
 */
export async function runPreflight(overrides?: GuardianAztecAdapterOptions): Promise<GuardianAccountStatus> {
    let status = await guardianAztecAdapter.getStatus(overrides);
    if (!status.isContractInitialized) {
        const deployed = await guardianAztecAdapter.deployIfNeeded(overrides);
        if (!deployed.deployed && !deployed.isContractInitialized) {
            throw new Error("Guardian account contract is not initialized and deployment did not succeed");
        }
        status = deployed;
    }
    if (status.isWhitelisted === false) {
        throw new Error(
            "Guardian is not whitelisted in the certificate registry. " +
                (status.whitelistStatusError ? status.whitelistStatusError : "")
        );
    }
    return status;
}
