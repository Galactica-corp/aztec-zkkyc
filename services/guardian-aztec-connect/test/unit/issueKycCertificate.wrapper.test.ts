import { jest } from "@jest/globals";
import { Fr } from "@aztec/aztec.js/fields";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import { createAddressStub, createZkKycInput } from "../support/fixtures.js";

const jestWithEsmMocks = jest as typeof jest & {
    unstable_mockModule: (moduleName: string, factory: () => object) => void;
};

jestWithEsmMocks.unstable_mockModule("../../src/runtime/guardianRegistryContext.js", () => ({
    loadGuardianRegistryContext: jest.fn(),
}));

jestWithEsmMocks.unstable_mockModule("../../src/kyc/zkKyc.js", () => ({
    prepareZkKycCertificateIssuance: jest.fn(),
}));

jestWithEsmMocks.unstable_mockModule("../../src/contracts/certificateRegistryClient.js", () => ({
    issueCertificate: jest.fn(),
}));

const { loadGuardianRegistryContext } = await import("../../src/runtime/guardianRegistryContext.js");
const { prepareZkKycCertificateIssuance } = await import("../../src/kyc/zkKyc.js");
const { issueCertificate } = await import("../../src/contracts/certificateRegistryClient.js");
const { issueKycCertificate } = await import("../../src/issuance/issueKycCertificate.js");

describe("issueKycCertificate", () => {
    it("loads the shared registry context and submits issuance through the wrapper", async () => {
        const guardianAddress = createAddressStub("0xguardian");
        const userAddress = createAddressStub("0xuser");
        const network = resolveNetworkConfig({ aztecEnv: "local-network" });
        const certificateRegistryClient = { id: "registry-client" };

        (loadGuardianRegistryContext as unknown as { mockResolvedValue(value: unknown): void }).mockResolvedValue({
            network,
            account: { address: guardianAddress },
            paymentMethod: { kind: "sponsored" },
            certificateRegistryClient,
        });
        (
            prepareZkKycCertificateIssuance as unknown as { mockResolvedValue(value: unknown): void }
        ).mockResolvedValue({
            userAddress,
            uniqueId: new Fr(11n),
            revocationId: new Fr(22n),
            contentType: new Fr(1n),
            personalData: [new Fr(1), new Fr(2), new Fr(3), new Fr(4), new Fr(5), new Fr(6), new Fr(0)],
            addressData: [new Fr(7), new Fr(8), new Fr(9), new Fr(10), new Fr(11), new Fr(0), new Fr(0)],
        });
        (issueCertificate as unknown as { mockResolvedValue(value: unknown): void }).mockResolvedValue({
            txHash: "0xtxhash",
        });

        await expect(issueKycCertificate({
            aztecEnv: "local-network",
            certificateRegistryAddress: "0xregistry",
            kyc: createZkKycInput(),
        })).resolves.toMatchObject({
            guardianAddress,
            userAddress,
            uniqueId: 11n,
            revocationId: 22n,
            txHash: "0xtxhash",
        });

        expect((loadGuardianRegistryContext as unknown as { mock: { calls: unknown[][] } }).mock.calls).toEqual([[{
            aztecEnv: "local-network",
            certificateRegistryAddress: "0xregistry",
            kyc: createZkKycInput(),
        }]]);
    });
});
