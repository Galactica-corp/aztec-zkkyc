import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { resolveNetworkConfig } from "../config/networkConfig.js";
import type { GuardianRuntime, GuardianRuntimeOptions } from "../types.js";
import { createGuardianAccount } from "../wallet/guardianAccount.js";
import { getSponsoredFPCInstance } from "../wallet/sponsoredFee.js";
import { createGuardianWallet } from "../wallet/setupWallet.js";

export interface SponsoredGuardianRuntime extends GuardianRuntime {
    paymentMethod: SponsoredFeePaymentMethod;
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

export async function loadSponsoredGuardianRuntime(
    options: GuardianRuntimeOptions = {}
): Promise<SponsoredGuardianRuntime> {
    const runtime = await loadGuardianRuntime(options);
    const sponsoredFPC = await getSponsoredFPCInstance();
    await runtime.wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);

    return {
        ...runtime,
        paymentMethod: new SponsoredFeePaymentMethod(sponsoredFPC.address),
    };
}
