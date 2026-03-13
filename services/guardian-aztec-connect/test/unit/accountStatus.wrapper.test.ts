import { jest } from "@jest/globals";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import { createAddressStub, createRegisteredAddress } from "../support/fixtures.js";

const jestWithEsmMocks = jest as typeof jest & {
    unstable_mockModule: (moduleName: string, factory: () => object) => void;
};

jestWithEsmMocks.unstable_mockModule("../../src/runtime/guardianRuntime.js", () => ({
    loadGuardianRuntime: jest.fn(),
}));

jestWithEsmMocks.unstable_mockModule("../../src/contracts/certificateRegistryClient.js", () => ({
    createCertificateRegistryClientFromRuntime: jest.fn(),
    getGuardianWhitelistStatus: jest.fn(),
}));

const { loadGuardianRuntime } = await import("../../src/runtime/guardianRuntime.js");
const {
    createCertificateRegistryClientFromRuntime,
    getGuardianWhitelistStatus,
} = await import("../../src/contracts/certificateRegistryClient.js");
const { getGuardianAccountStatus } = await import("../../src/wallet/accountStatus.js");

describe("getGuardianAccountStatus", () => {
    it("loads the runtime and registry client through the top-level wrapper", async () => {
        const guardianAddress = createAddressStub("0xguardian");
        const runtime = {
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
            account: { address: guardianAddress },
            wallet: {
                async getAccounts() {
                    return [createRegisteredAddress(guardianAddress)];
                },
                async getContractMetadata() {
                    return { isContractInitialized: true };
                },
            },
        };

        (loadGuardianRuntime as unknown as { mockResolvedValue(value: unknown): void }).mockResolvedValue(runtime);
        (
            createCertificateRegistryClientFromRuntime as unknown as { mockResolvedValue(value: unknown): void }
        ).mockResolvedValue({ id: "registry-client" });
        (getGuardianWhitelistStatus as unknown as { mockResolvedValue(value: unknown): void }).mockResolvedValue(true);

        await expect(getGuardianAccountStatus({
            aztecEnv: "local-network",
            certificateRegistryAddress: "0xregistry",
        })).resolves.toMatchObject({
            address: guardianAddress,
            isContractInitialized: true,
            isWhitelisted: true,
        });

        expect((loadGuardianRuntime as unknown as { mock: { calls: unknown[][] } }).mock.calls).toEqual([[{
            aztecEnv: "local-network",
            certificateRegistryAddress: "0xregistry",
        }]]);
        expect(
            (createCertificateRegistryClientFromRuntime as unknown as { mock: { calls: unknown[][] } }).mock.calls
        ).toEqual([[runtime, {
            aztecEnv: "local-network",
            certificateRegistryAddress: "0xregistry",
        }]]);
    });
});
