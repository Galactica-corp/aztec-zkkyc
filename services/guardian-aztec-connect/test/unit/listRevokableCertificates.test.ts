import { jest } from "@jest/globals";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import { createAddressStub } from "../support/fixtures.js";

const jestWithEsmMocks = jest as typeof jest & {
    unstable_mockModule: (moduleName: string, factory: () => object) => void;
};

jestWithEsmMocks.unstable_mockModule("../../src/runtime/guardianRegistryContext.js", () => ({
    loadGuardianRegistryContext: jest.fn(),
}));

jestWithEsmMocks.unstable_mockModule("../../src/contracts/certificateRegistryClient.js", () => ({
    listGuardianCertificateCopies: jest.fn(),
}));

const { loadGuardianRegistryContext } = await import("../../src/runtime/guardianRegistryContext.js");
const { listGuardianCertificateCopies } = await import("../../src/contracts/certificateRegistryClient.js");
const {
    listRevokableCertificates,
    listRevokableCertificatesFromDependencies,
} = await import("../../src/certificates/listRevokableCertificates.js");

describe("listRevokableCertificatesFromDependencies", () => {
    it("returns the guardian certificate-copy summary with network context", async () => {
        const guardianAddress = createAddressStub("0xguardian");
        const network = resolveNetworkConfig({ aztecEnv: "local-network" });

        await expect(listRevokableCertificatesFromDependencies({
            network,
            guardianAddress,
            async listCertificates() {
                return {
                    count: 2,
                    certificates: [
                        {
                            guardianAddress,
                            uniqueId: 101n,
                            revocationId: 201n,
                            contentType: 1n,
                        },
                        {
                            guardianAddress,
                            uniqueId: 102n,
                            revocationId: 202n,
                            contentType: 1n,
                        },
                    ],
                };
            },
        })).resolves.toEqual({
            guardianAddress,
            network,
            count: 2,
            certificates: [
                {
                    guardianAddress,
                    uniqueId: 101n,
                    revocationId: 201n,
                    contentType: 1n,
                },
                {
                    guardianAddress,
                    uniqueId: 102n,
                    revocationId: 202n,
                    contentType: 1n,
                },
            ],
        });
    });
});

describe("listRevokableCertificates", () => {
    it("loads the shared registry context and lists guardian certificate copies", async () => {
        const guardianAddress = createAddressStub("0xguardian");
        const network = resolveNetworkConfig({ aztecEnv: "local-network" });
        const certificateRegistryClient = { id: "registry-client" };

        (loadGuardianRegistryContext as unknown as { mockResolvedValue(value: unknown): void }).mockResolvedValue({
            network,
            account: { address: guardianAddress },
            certificateRegistryClient,
        });
        (listGuardianCertificateCopies as unknown as { mockResolvedValue(value: unknown): void }).mockResolvedValue({
            count: 1,
            certificates: [
                {
                    guardianAddress,
                    uniqueId: 999n,
                    revocationId: 555n,
                    contentType: 1n,
                },
            ],
        });

        await expect(listRevokableCertificates({
            aztecEnv: "local-network",
            certificateRegistryAddress: "0xregistry",
        })).resolves.toEqual({
            guardianAddress,
            network,
            count: 1,
            certificates: [
                {
                    guardianAddress,
                    uniqueId: 999n,
                    revocationId: 555n,
                    contentType: 1n,
                },
            ],
        });

        expect(
            (loadGuardianRegistryContext as unknown as { mock: { calls: unknown[][] } }).mock.calls
        ).toEqual([[{
            aztecEnv: "local-network",
            certificateRegistryAddress: "0xregistry",
        }]]);
        expect(
            (listGuardianCertificateCopies as unknown as { mock: { calls: unknown[][] } }).mock.calls
        ).toEqual([[certificateRegistryClient, guardianAddress]]);
    });
});
