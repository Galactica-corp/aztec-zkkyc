import { jest } from "@jest/globals";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import { ContractInitializationStatus } from "@aztec/aztec.js/wallet";
import { createAddressStub } from "../support/fixtures.js";

const jestWithEsmMocks = jest as typeof jest & {
    unstable_mockModule: (moduleName: string, factory: () => object) => void;
};

jestWithEsmMocks.unstable_mockModule("../../src/runtime/guardianRuntime.js", () => ({
    loadSponsoredGuardianRuntime: jest.fn(),
    loadGuardianRuntime: jest.fn(),
}));

jestWithEsmMocks.unstable_mockModule("../../src/contracts/certificateRegistryClient.js", () => ({
    createCertificateRegistryClientFromRuntime: jest.fn(),
    getGuardianWhitelistStatus: jest.fn(),
}));

const { loadSponsoredGuardianRuntime } = await import("../../src/runtime/guardianRuntime.js");
const {
    createCertificateRegistryClientFromRuntime,
    getGuardianWhitelistStatus,
} = await import("../../src/contracts/certificateRegistryClient.js");
const { deployGuardianAccountIfNeeded } = await import("../../src/wallet/deployAccount.js");

describe("deployGuardianAccountIfNeeded", () => {
    it("loads the sponsored runtime and reuses the wrapper whitelist lookup", async () => {
        const guardianAddress = createAddressStub("0xguardian");
        let metadataCalls = 0;
        const runtime = {
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
            account: {
                address: guardianAddress,
                async getDeployMethod() {
                    return {
                        async send() {
                            return undefined;
                        },
                    };
                },
            },
            paymentMethod: { kind: "sponsored" },
            wallet: {
                async getAccounts() {
                    return [];
                },
                async getContractMetadata() {
                    metadataCalls += 1;
                    return {
                        initializationStatus: metadataCalls > 1
                            ? ContractInitializationStatus.INITIALIZED
                            : ContractInitializationStatus.UNINITIALIZED,
                    };
                },
                async registerSender() {
                    return undefined;
                },
            },
        };

        (loadSponsoredGuardianRuntime as unknown as { mockResolvedValue(value: unknown): void }).mockResolvedValue(runtime);
        (
            createCertificateRegistryClientFromRuntime as unknown as { mockResolvedValue(value: unknown): void }
        ).mockResolvedValue({ id: "registry-client" });
        (getGuardianWhitelistStatus as unknown as { mockResolvedValue(value: unknown): void }).mockResolvedValue(true);

        await expect(deployGuardianAccountIfNeeded({
            aztecEnv: "local-network",
            certificateRegistryAddress: "0xregistry",
        })).resolves.toMatchObject({
            address: guardianAddress,
            deployed: true,
            isWhitelisted: true,
        });
    });
});
