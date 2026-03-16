declare module "@galactica-net/guardian-aztec-connect" {
    export interface GuardianAccountStatus {
        address: unknown;
        network: unknown;
        isRegisteredInWallet: boolean;
        isContractInitialized: boolean;
        isWhitelisted: boolean | null;
        whitelistStatusError?: string;
    }
    export interface DeployGuardianAccountResult extends GuardianAccountStatus {
        deployed: boolean;
    }
    export interface IssueKycCertificateResult {
        guardianAddress: unknown;
        userAddress: unknown;
        network: unknown;
        uniqueId: bigint;
        revocationId: bigint;
        txHash: string;
    }
    export interface ZkKycInput {
        userAddress: string | unknown;
        personal: unknown;
        address: unknown;
    }
    export interface RevokeCertificateResult {
        guardianAddress: unknown;
        network: unknown;
        revocationId: bigint;
        txHash: string;
    }
    export interface ListRevokableCertificatesResult {
        guardianAddress: unknown;
        network: unknown;
        count: number;
        certificates: Array<{ uniqueId: bigint; revocationId: bigint; contentType: bigint }>;
    }
    export function getGuardianAccountStatus(_opts?: unknown): Promise<GuardianAccountStatus>;
    export function deployGuardianAccountIfNeeded(_opts?: unknown): Promise<DeployGuardianAccountResult>;
    export function issueKycCertificate(_opts?: unknown): Promise<IssueKycCertificateResult>;
    export function revokeCertificate(_opts?: unknown): Promise<RevokeCertificateResult>;
    export function listRevokableCertificates(_opts?: unknown): Promise<ListRevokableCertificatesResult>;
}
