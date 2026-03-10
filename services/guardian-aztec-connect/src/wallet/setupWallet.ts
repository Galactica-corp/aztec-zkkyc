import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { registerInitialLocalNetworkAccountsInWallet } from "@aztec/wallets/testing";
import type { EmbeddedWallet } from "@aztec/wallets/embedded";
import { EmbeddedWallet as EmbeddedWalletFactory } from "@aztec/wallets/embedded";
import type { GuardianWalletSetupOptions } from "../types.js";
import { resolveNetworkConfig } from "../config/networkConfig.js";

export async function createGuardianWallet(options: GuardianWalletSetupOptions = {}): Promise<EmbeddedWallet> {
    const network = resolveNetworkConfig({ aztecEnv: options.aztecEnv });
    const node = createAztecNodeClient(network.nodeUrl);
    const wallet = await EmbeddedWalletFactory.create(node, {
        ephemeral: options.ephemeral ?? false,
        pxeConfig: {
            proverEnabled: network.name !== "local-network",
        },
    });

    if (network.name === "local-network" && options.registerInitialAccounts !== false) {
        await registerInitialLocalNetworkAccountsInWallet(wallet);
    }

    return wallet;
}
