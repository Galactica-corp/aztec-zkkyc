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
            async getWhitelistStatus() {
                return { isWhitelisted: true };
            },
        });

        expect(status.address).toBe(address);
        expect(status.network).toBe(network);
        expect(status.isRegisteredInWallet).toBe(true);
        expect(status.isContractInitialized).toBe(true);
        expect(status.isWhitelisted).toBe(true);
        expect(status.whitelistStatusError).toBeUndefined();
    });

    it("returns false when the guardian is not whitelisted", async () => {
        const address = createAddressStub() as AztecAddress;

        const status = await getGuardianAccountStatusFromDependencies({
            network: getLocalNetworkConfig(),
            account: { address },
            wallet: {
                async getAccounts() {
                    return [createRegisteredAddress(address)];
                },
                async getContractMetadata() {
                    return { isContractInitialized: false };
                },
            },
            async getWhitelistStatus() {
                return { isWhitelisted: false };
            },
        });

        expect(status.isWhitelisted).toBe(false);
        expect(status.whitelistStatusError).toBeUndefined();
    });

    it("keeps account status working when the whitelist lookup fails", async () => {
        const address = createAddressStub() as AztecAddress;

        const status = await getGuardianAccountStatusFromDependencies({
            network: getLocalNetworkConfig(),
            account: { address },
            wallet: {
                async getAccounts() {
                    return [];
                },
                async getContractMetadata() {
                    return { isContractInitialized: false };
                },
            },
            async getWhitelistStatus() {
                throw new Error("whitelist temporarily unavailable");
            },
        });

        expect(status.isRegisteredInWallet).toBe(false);
        expect(status.isContractInitialized).toBe(false);
        expect(status.isWhitelisted).toBeNull();
        expect(status.whitelistStatusError).toBe("whitelist temporarily unavailable");
    });
});
