import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import { getGuardianAccountStatusFromDependencies } from "../../src/wallet/accountStatus.js";
import { createAddressStub, createRegisteredAddress, getLocalNetworkConfig } from "../support/fixtures.js";

describe("getGuardianAccountStatusFromDependencies", () => {
    it("returns wallet registration and deployment state", async () => {
        const network = getLocalNetworkConfig();
        const address = createAddressStub() as AztecAddress;

        const status = await getGuardianAccountStatusFromDependencies({
            network,
            account: { address },
            wallet: {
                async getAccounts() {
                    return [createRegisteredAddress(address)];
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
