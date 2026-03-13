import { jest } from "@jest/globals";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import { createAddressStub } from "../support/fixtures.js";
import type { GuardianSendOptions } from "../../src/tx/guardianTx.js";
import type { RevokeCertificateOptions } from "../../src/types.js";

const jestWithEsmMocks = jest as typeof jest & {
    unstable_mockModule: (moduleName: string, factory: () => object) => void;
};

jestWithEsmMocks.unstable_mockModule("../../src/runtime/guardianRegistryContext.js", () => ({
    loadGuardianRegistryContext: jest.fn(),
}));

jestWithEsmMocks.unstable_mockModule("../../src/contracts/certificateRegistryClient.js", () => ({
    revokeCertificateByRevocationId: jest.fn(),
}));

const { loadGuardianRegistryContext } = await import("../../src/runtime/guardianRegistryContext.js");
const { revokeCertificateByRevocationId } = await import("../../src/contracts/certificateRegistryClient.js");
const {
    revokeCertificate,
    revokeCertificateFromDependencies,
} = await import("../../src/revocation/revokeCertificate.js");

describe("revokeCertificateFromDependencies", () => {
    it("submits certificate revocation with sponsored fee payment and returns the tx hash", async () => {
        const network = resolveNetworkConfig({ aztecEnv: "local-network" });
        const guardianAddress = createAddressStub("0xguardian");
        const sentOptions: unknown[] = [];

        const result = await revokeCertificateFromDependencies({
            network,
            account: { address: guardianAddress },
            paymentMethod: { kind: "sponsored" },
            revocationId: "222",
            async submitRevocation(
                revocationId: RevokeCertificateOptions["revocationId"],
                options: GuardianSendOptions
            ) {
                expect(revocationId).toBe("222");
                sentOptions.push(options);
                return { txHash: "0xrevokehash" };
            },
        });

        expect(sentOptions).toEqual([{
            from: guardianAddress,
            fee: { paymentMethod: { kind: "sponsored" } },
            wait: { timeout: network.txTimeoutMs, returnReceipt: true },
        }]);
        expect(result).toEqual({
            guardianAddress,
            network,
            revocationId: 222n,
            txHash: "0xrevokehash",
        });
    });
});

describe("revokeCertificate", () => {
    it("loads the shared registry context and submits a revocation", async () => {
        const guardianAddress = createAddressStub("0xguardian");
        const network = resolveNetworkConfig({ aztecEnv: "local-network" });
        const certificateRegistryClient = { id: "registry-client" };

        (loadGuardianRegistryContext as unknown as { mockResolvedValue(value: unknown): void }).mockResolvedValue({
            network,
            account: { address: guardianAddress },
            paymentMethod: { kind: "sponsored" },
            certificateRegistryClient,
        });
        (revokeCertificateByRevocationId as unknown as { mockResolvedValue(value: unknown): void }).mockResolvedValue({
            txHash: "0xrevokehash",
        });

        await expect(revokeCertificate({
            aztecEnv: "local-network",
            certificateRegistryAddress: "0xregistry",
            revocationId: "222",
        })).resolves.toEqual({
            guardianAddress,
            network,
            revocationId: 222n,
            txHash: "0xrevokehash",
        });

        expect(
            (loadGuardianRegistryContext as unknown as { mock: { calls: unknown[][] } }).mock.calls
        ).toEqual([[{
            aztecEnv: "local-network",
            certificateRegistryAddress: "0xregistry",
            revocationId: "222",
        }]]);
        expect(
            (revokeCertificateByRevocationId as unknown as { mock: { calls: unknown[][] } }).mock.calls
        ).toEqual([[certificateRegistryClient, "222", {
            from: guardianAddress,
            fee: { paymentMethod: { kind: "sponsored" } },
            wait: { timeout: network.txTimeoutMs, returnReceipt: true },
        }]]);
    });
});
