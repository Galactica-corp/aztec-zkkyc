import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import { getGuardianAccountStatusFromDependencies } from "../../src/wallet/accountStatus.js";

describe("getGuardianAccountStatusFromDependencies", () => {
    it("returns wallet registration and deployment state", async () => {
        const network = resolveNetworkConfig({ aztecEnv: "local-network" });
        const address = {
            equals: (other: unknown) => other === address,
            toString: () => "0xguardian",
        } as unknown as AztecAddress;

        const status = await getGuardianAccountStatusFromDependencies({
            network,
            account: { address },
            wallet: {
                async getAccounts() {
                    return [{ item: address }];
                },
                async getContractMetadata() {
                    return { isContractInitialized: true };
                },
            },
        });

        expect(status.address).toBe(address);
        expect(status.network).toBe(network);
        expect(status.isRegisteredInWallet).toBe(true);
        expect(status.isContractInitialized).toBe(true);
    });
});
