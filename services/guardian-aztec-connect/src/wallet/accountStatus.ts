import type { AccountManager } from "@aztec/aztec.js/wallet";
import type { GuardianAccountStatus, GuardianNetworkConfig, GuardianWalletSetupOptions } from "../types.js";
import { loadGuardianRuntime } from "../runtime/guardianRuntime.js";

interface ContractMetadata {
    isContractInitialized: boolean;
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
}

export async function getGuardianAccountStatusFromDependencies(
    dependencies: GuardianStatusDependencies
): Promise<GuardianAccountStatus> {
    const registeredAccounts = await dependencies.wallet.getAccounts();
    const metadata = await dependencies.wallet.getContractMetadata(dependencies.account.address);
    const isRegisteredInWallet = registeredAccounts.some((registeredAccount) =>
        registeredAccount.item.equals(dependencies.account.address)
    );

    return {
        address: dependencies.account.address,
        network: dependencies.network,
        isRegisteredInWallet,
        isContractInitialized: metadata.isContractInitialized,
    };
}

export async function getGuardianAccountStatus(options: GuardianWalletSetupOptions = {}): Promise<GuardianAccountStatus> {
    const runtime = await loadGuardianRuntime(options);

    return await getGuardianAccountStatusFromDependencies({
        wallet: runtime.wallet,
        account: runtime.account,
        network: runtime.network,
    });
}

export type { ContractMetadata, RegisteredAccount };
