import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { AccountManager } from "@aztec/aztec.js/wallet";
import type { EmbeddedWallet } from "@aztec/wallets/embedded";

export type GuardianEnvironment = "local" | "testnet" | "devnet" | "mainnet";

export interface GuardianNetworkConfig {
    name: string;
    environment: GuardianEnvironment;
    nodeUrl: string;
    l1RpcUrl: string;
    l1ChainId: number;
    txTimeoutMs: number;
    deployTimeoutMs: number;
    waitTimeoutMs: number;
    configPath: string;
}

export interface GuardianWalletSetupOptions {
    aztecEnv?: string;
    ephemeral?: boolean;
    registerInitialAccounts?: boolean;
    inputPath?: string;
}

export interface CertificateRegistrySetupOptions {
    certificateRegistryAddress?: AztecAddress | string;
    certificateRegistryAdminAddress?: AztecAddress | string;
    certificateRegistryDeploymentSalt?: string;
    certificateRegistryDeployerAddress?: AztecAddress | string;
}

export type GuardianStatusOptions = GuardianWalletSetupOptions & CertificateRegistrySetupOptions;

export interface GuardianWhitelistStatus {
    isWhitelisted: boolean | null;
    whitelistStatusError?: string;
}

export interface GuardianAccountStatus extends GuardianWhitelistStatus {
    address: AztecAddress;
    network: GuardianNetworkConfig;
    isRegisteredInWallet: boolean;
    isContractInitialized: boolean;
}

export interface DeployGuardianAccountResult extends GuardianAccountStatus {
    deployed: boolean;
}

export interface GuardianRuntime {
    network: GuardianNetworkConfig;
    wallet: EmbeddedWallet;
    account: AccountManager;
}

export interface ZkKycPersonalData {
    surname: string;
    forename: string;
    middlename?: string;
    birthday: string;
    citizenship: string;
    verificationLevel: number;
}

export interface ZkKycAddressData {
    streetAndNumber: string;
    postcode: string;
    town: string;
    region?: string;
    country: string;
}

export interface ZkKycInput {
    userAddress: AztecAddress | string;
    personal: ZkKycPersonalData;
    address: ZkKycAddressData;
}

export interface IssueKycCertificateOptions extends GuardianStatusOptions {
    kyc: ZkKycInput;
    uniqueId?: bigint | number | string;
    revocationId?: bigint | number | string;
}

export interface IssueKycCertificateResult {
    guardianAddress: AztecAddress;
    userAddress: AztecAddress;
    network: GuardianNetworkConfig;
    uniqueId: bigint;
    revocationId: bigint;
    txHash: string;
}
