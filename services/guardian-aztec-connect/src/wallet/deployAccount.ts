import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import type { AccountManager } from "@aztec/aztec.js/wallet";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import type {
    DeployGuardianAccountResult,
    GuardianNetworkConfig,
    GuardianWalletSetupOptions,
} from "../types.js";
import { loadSponsoredGuardianRuntime } from "../runtime/guardianRuntime.js";
import { getGuardianAccountStatusFromDependencies } from "./accountStatus.js";

interface DeployMethodLike {
    send(options: unknown): Promise<unknown>;
}

export interface DeployGuardianDependencies {
    wallet: {
        getAccounts(): Promise<Array<{ item: { equals(other: unknown): boolean } }>>;
        getContractMetadata(address: unknown): Promise<{ isContractInitialized: boolean }>;
        registerSender(address: unknown, alias: string): Promise<unknown>;
    };
    account: {
        address: AccountManager["address"];
        getDeployMethod(): Promise<DeployMethodLike>;
    };
    paymentMethod: unknown;
    network: GuardianNetworkConfig;
}

export async function deployGuardianAccountIfNeededFromDependencies(
    dependencies: DeployGuardianDependencies
): Promise<DeployGuardianAccountResult> {
    const initialStatus = await getGuardianAccountStatusFromDependencies(dependencies);
    if (initialStatus.isContractInitialized) {
        return {
            ...initialStatus,
            deployed: false,
        };
    }

    const deployMethod = await dependencies.account.getDeployMethod();
    const sendOptions = {
        fee: { paymentMethod: dependencies.paymentMethod },
        wait: { timeout: dependencies.network.txTimeoutMs, returnReceipt: true },
    };

    try {
        await deployMethod.send({
            from: AztecAddress.ZERO,
            ...sendOptions,
        });
    } catch {
        await deployMethod.send({
            from: dependencies.account.address,
            ...sendOptions,
        });
    }

    await dependencies.wallet.registerSender(dependencies.account.address, "guardian");

    const deployedStatus = await getGuardianAccountStatusFromDependencies(dependencies);
    if (!deployedStatus.isContractInitialized) {
        throw new Error(`Guardian account ${dependencies.account.address.toString()} is still not initialized`);
    }

    return {
        ...deployedStatus,
        deployed: true,
    };
}

export async function deployGuardianAccountIfNeeded(
    options: GuardianWalletSetupOptions = {}
): Promise<DeployGuardianAccountResult> {
    const runtime = await loadSponsoredGuardianRuntime(options);

    return await deployGuardianAccountIfNeededFromDependencies({
        wallet: runtime.wallet,
        account: runtime.account,
        paymentMethod: runtime.paymentMethod,
        network: runtime.network,
    });
}

export { AztecAddress };
export type { DeployMethodLike };
