import { jest } from "@jest/globals";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import { createAddressStub } from "../support/fixtures.js";

const jestWithEsmMocks = jest as typeof jest & {
    unstable_mockModule: (moduleName: string, factory: () => object) => void;
};

jestWithEsmMocks.unstable_mockModule("../../src/runtime/guardianRuntime.js", () => ({
    loadSponsoredGuardianRuntime: jest.fn(),
}));

jestWithEsmMocks.unstable_mockModule("../../src/contracts/certificateRegistryClient.js", () => ({
    createCertificateRegistryClientFromRuntime: jest.fn(),
}));

const { loadSponsoredGuardianRuntime } = await import("../../src/runtime/guardianRuntime.js");
const { createCertificateRegistryClientFromRuntime } = await import("../../src/contracts/certificateRegistryClient.js");
const { loadGuardianRegistryContext } = await import("../../src/runtime/guardianRegistryContext.js");

describe("loadGuardianRegistryContext", () => {
    it("loads the sponsored runtime and attaches a registry client", async () => {
        const runtime = {
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
            wallet: { id: "wallet" },
            account: { address: createAddressStub() },
            paymentMethod: { kind: "sponsored" },
        };
        const certificateRegistryClient = { id: "registry-client" };

        (loadSponsoredGuardianRuntime as unknown as { mockResolvedValue(value: unknown): void }).mockResolvedValue(runtime);
        (
            createCertificateRegistryClientFromRuntime as unknown as { mockResolvedValue(value: unknown): void }
        ).mockResolvedValue(certificateRegistryClient);

        await expect(loadGuardianRegistryContext({
            aztecEnv: "local-network",
            certificateRegistryAddress: createAddressStub("0xregistry").toString(),
        })).resolves.toEqual({
            ...runtime,
            certificateRegistryClient,
        });
    });
});
