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
