import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import { AztecAddress as AztecAddressValue, deployGuardianAccountIfNeededFromDependencies, type DeployMethodLike } from "../../src/wallet/deployAccount.js";
import { createAddressStub, createRegisteredAddress } from "../support/fixtures.js";

describe("deployGuardianAccountIfNeededFromDependencies", () => {
    it("deploys through ZERO sender when the account is not initialized", async () => {
        const network = resolveNetworkConfig({ aztecEnv: "local-network" });
        const address = createAddressStub() as AztecAddress;
        const sentOptions: unknown[] = [];
        const senderRegistrations: Array<{ address: unknown; alias: string }> = [];
        const send: DeployMethodLike["send"] = async (options: unknown) => {
            sentOptions.push(options);
            return undefined;
        };
        let metadataCalls = 0;

        const result = await deployGuardianAccountIfNeededFromDependencies({
            network,
            paymentMethod: { kind: "sponsored" },
            account: {
                address,
                async getDeployMethod() {
                    return { send };
                },
            },
            wallet: {
                async getContractMetadata() {
                    metadataCalls += 1;
                    return { isContractInitialized: metadataCalls > 1 };
                },
                async registerSender(registeredAddress: unknown, alias: string) {
                    senderRegistrations.push({ address: registeredAddress, alias });
                    return registeredAddress;
                },
                async getAccounts() {
                    return [];
                },
            },
        });

        expect(sentOptions).toEqual([{
            from: AztecAddressValue.ZERO,
            fee: { paymentMethod: { kind: "sponsored" } },
            wait: { timeout: 60000, returnReceipt: true },
        }]);
        expect(senderRegistrations).toEqual([{ address, alias: "guardian" }]);
        expect(result.deployed).toBe(true);
        expect(result.isContractInitialized).toBe(true);
    });

    it("returns without deploying an initialized account", async () => {
        const network = resolveNetworkConfig({ aztecEnv: "local-network" });
        const address = createAddressStub() as AztecAddress;
        let sendCalls = 0;
        const send: DeployMethodLike["send"] = async () => {
            sendCalls += 1;
            return undefined;
        };

        const result = await deployGuardianAccountIfNeededFromDependencies({
            network,
            paymentMethod: { kind: "sponsored" },
            account: {
                address,
                async getDeployMethod() {
                    return { send };
                },
            },
            wallet: {
                async getContractMetadata() {
                    return { isContractInitialized: true };
                },
                async getAccounts() {
                    return [createRegisteredAddress(address)];
                },
                async registerSender() {
                    return;
                },
            },
        });

        expect(sendCalls).toBe(0);
        expect(result.deployed).toBe(false);
        expect(result.isRegisteredInWallet).toBe(true);
        expect(result.isContractInitialized).toBe(true);
    });
});
