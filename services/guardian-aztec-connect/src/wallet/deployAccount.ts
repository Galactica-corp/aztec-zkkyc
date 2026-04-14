import { NO_FROM } from "@aztec/aztec.js/account";
import type { AccountManager } from "@aztec/aztec.js/wallet";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import type {
    DeployGuardianAccountResult,
    GuardianNetworkConfig,
    GuardianStatusOptions,
} from "../types.js";
import { loadSponsoredGuardianRuntime } from "../runtime/guardianRuntime.js";
import { buildGuardianSendOptions } from "../tx/guardianTx.js";
import {
    type GuardianStatusDependencies,
    getGuardianAccountStatusFromDependencies,
    getGuardianWhitelistStatusFromRuntime,
} from "./accountStatus.js";

interface DeployMethodLike {
    send(options: unknown): Promise<unknown>;
}

export interface DeployGuardianDependencies {
    wallet: GuardianStatusDependencies["wallet"] & {
        registerSender(address: unknown, alias: string): Promise<unknown>;
    };
    account: GuardianStatusDependencies["account"] & {
        getDeployMethod(): Promise<DeployMethodLike>;
    };
    paymentMethod?: unknown;
    network: GuardianNetworkConfig;
    getWhitelistStatus?(): Promise<{ isWhitelisted: boolean }>;
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

    try {
        await deployMethod.send(buildGuardianSendOptions(
            NO_FROM,
            dependencies.paymentMethod,
            dependencies.network
        ));
    } catch {
        await deployMethod.send(buildGuardianSendOptions(
            dependencies.account.address,
            dependencies.paymentMethod,
            dependencies.network
        ));
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
    options: GuardianStatusOptions = {}
): Promise<DeployGuardianAccountResult> {
    const runtime = await loadSponsoredGuardianRuntime(options);

    return await deployGuardianAccountIfNeededFromDependencies({
        wallet: runtime.wallet,
        account: runtime.account,
        paymentMethod: runtime.paymentMethod,
        network: runtime.network,
        getWhitelistStatus: async () => await getGuardianWhitelistStatusFromRuntime(runtime, options),
    });
}

export { AztecAddress };
export type { DeployMethodLike };
