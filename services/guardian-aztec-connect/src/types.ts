import type { AztecAddress } from "@aztec/stdlib/aztec-address";

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

export interface GuardianAccountStatus {
    address: AztecAddress;
    network: GuardianNetworkConfig;
    isRegisteredInWallet: boolean;
    isContractInitialized: boolean;
}

export interface DeployGuardianAccountResult extends GuardianAccountStatus {
    deployed: boolean;
}
