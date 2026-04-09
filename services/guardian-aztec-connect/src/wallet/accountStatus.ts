import type { AccountManager } from "@aztec/aztec.js/wallet";
import { ContractInitializationStatus } from "@aztec/aztec.js/wallet";
import {
    createCertificateRegistryClientFromRuntime,
    getGuardianWhitelistStatus,
} from "../contracts/certificateRegistryClient.js";
import type {
    GuardianAccountStatus,
    GuardianRegistryOptions,
    GuardianNetworkConfig,
    GuardianRuntime,
    GuardianStatusOptions,
    GuardianWhitelistStatus,
} from "../types.js";
import { loadGuardianRuntime } from "../runtime/guardianRuntime.js";

interface ContractMetadata {
    initializationStatus: ContractInitializationStatus;
}

interface RegisteredAccount {
    item: {
        equals(other: unknown): boolean;
    };
}

export interface GuardianStatusDependencies {
    wallet: {
        getAccounts(): Promise<RegisteredAccount[]>;
        getContractMetadata(address: unknown): Promise<ContractMetadata>;
    };
    account: {
        address: AccountManager["address"];
    };
    network: GuardianNetworkConfig;
    getWhitelistStatus?(): Promise<{ isWhitelisted: boolean }>;
}

export async function getGuardianWhitelistStatusFromRuntime(
    runtime: GuardianRuntime,
    options: GuardianRegistryOptions = {}
): Promise<{ isWhitelisted: boolean }> {
    const client = await createCertificateRegistryClientFromRuntime(runtime, options);

    return {
        isWhitelisted: await getGuardianWhitelistStatus(client, runtime.account.address),
    };
}

export async function getGuardianAccountStatusFromDependencies(
    dependencies: GuardianStatusDependencies
): Promise<GuardianAccountStatus> {
    const registeredAccounts = await dependencies.wallet.getAccounts();
    const metadata = await dependencies.wallet.getContractMetadata(dependencies.account.address);
    const isRegisteredInWallet = registeredAccounts.some((registeredAccount) =>
        registeredAccount.item.equals(dependencies.account.address)
    );
    let whitelistStatus: GuardianWhitelistStatus = {
        isWhitelisted: null,
    };

    if (dependencies.getWhitelistStatus) {
        try {
            whitelistStatus = await dependencies.getWhitelistStatus();
        } catch (error: unknown) {
            whitelistStatus = {
                isWhitelisted: null,
                whitelistStatusError: error instanceof Error ? error.message : String(error),
            };
        }
    }

    return {
        address: dependencies.account.address,
        network: dependencies.network,
        isRegisteredInWallet,
        isContractInitialized: metadata.initializationStatus === ContractInitializationStatus.INITIALIZED,
        ...whitelistStatus,
    };
}

export async function getGuardianAccountStatus(options: GuardianStatusOptions = {}): Promise<GuardianAccountStatus> {
    const runtime = await loadGuardianRuntime(options);

    return await getGuardianAccountStatusFromDependencies({
        wallet: runtime.wallet,
        account: runtime.account,
        network: runtime.network,
        getWhitelistStatus: async () => await getGuardianWhitelistStatusFromRuntime(runtime, options),
    });
}

export type { ContractMetadata, RegisteredAccount };
