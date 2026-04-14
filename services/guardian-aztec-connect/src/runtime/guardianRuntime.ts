import { resolveNetworkConfig } from "../config/networkConfig.js";
import type { GuardianRuntime, GuardianRuntimeOptions } from "../types.js";
import { createGuardianAccount } from "../wallet/guardianAccount.js";
import { createGuardianWallet } from "../wallet/setupWallet.js";

export interface GuardianRuntimeWithFees extends GuardianRuntime {
    /**
     * Optional fee payment method to include with tx send options.
     *
     * On public networks (testnet/mainnet), the guardian should usually pay fees via its own funds,
     * so this is intentionally left undefined.
     */
    paymentMethod?: unknown;
}

export async function loadGuardianRuntime(options: GuardianRuntimeOptions = {}): Promise<GuardianRuntime> {
    const network = resolveNetworkConfig({ aztecEnv: options.aztecEnv });
    const wallet = await createGuardianWallet(options);
    const account = await createGuardianAccount(wallet);

    return {
        network,
        wallet,
        account,
    };
}

/**
 * Loads the guardian runtime and optionally configures a Sponsored FPC payment method.
 *
 * The Aztec public testnet should not rely on sponsored fee payments.
 */
export async function loadGuardianRuntimeWithFees(
    options: GuardianRuntimeOptions = {}
): Promise<GuardianRuntimeWithFees> {
    const runtime = await loadGuardianRuntime(options);

    // Use sponsored fees only on the local network by default.
    if (runtime.network.name !== "local-network") {
        return runtime;
    }

    const { SponsoredFeePaymentMethod } = await import("@aztec/aztec.js/fee");
    const { SponsoredFPCContract } = await import("@aztec/noir-contracts.js/SponsoredFPC");
    const { getSponsoredFPCInstance } = await import("../wallet/sponsoredFee.js");

    const sponsoredFPC = await getSponsoredFPCInstance();
    await runtime.wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);

    return {
        ...runtime,
        paymentMethod: new SponsoredFeePaymentMethod(sponsoredFPC.address),
    };
}

/**
 * Backwards-compatible name (used by internal unit tests).
 * Prefer `loadGuardianRuntimeWithFees`.
 */
export async function loadSponsoredGuardianRuntime(
    options: GuardianRuntimeOptions = {}
): Promise<GuardianRuntimeWithFees> {
    return await loadGuardianRuntimeWithFees(options);
}
