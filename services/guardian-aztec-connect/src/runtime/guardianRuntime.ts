import { resolveNetworkConfig } from "../config/networkConfig.js";
import type { GuardianRuntime, GuardianRuntimeOptions } from "../types.js";
import { createGuardianAccount } from "../wallet/guardianAccount.js";
import { createGuardianWallet } from "../wallet/setupWallet.js";

export interface GuardianRuntimeWithFees extends GuardianRuntime {
    /**
     * Optional fee payment method to include with tx send options.
     *
     * Mirrors the rules in `crates/zk_certificate/src/utils/fpc.ts`:
     * - On local-network and testnet the guardian pays via the canonical Sponsored FPC.
     * - On mainnet no sponsored payment method is attached, so the guardian must supply
     *   its own fee payment (e.g. a private FPC) at the call site.
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
 * Loads the guardian runtime and configures a Sponsored FPC payment method where available.
 *
 * The canonical SponsoredFPC is deployed on both the local network and the public testnet,
 * so we use it to cover transaction fees in those environments. On mainnet the guardian is
 * expected to supply its own fee payment method (see `crates/zk_certificate/src/utils/fpc.ts`).
 */
export async function loadGuardianRuntimeWithFees(
    options: GuardianRuntimeOptions = {}
): Promise<GuardianRuntimeWithFees> {
    const runtime = await loadGuardianRuntime(options);

    if (runtime.network.environment === "mainnet") {
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
