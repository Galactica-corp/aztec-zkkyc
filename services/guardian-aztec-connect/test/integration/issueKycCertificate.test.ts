import { issueKycCertificate } from "../../src/issuance/issueKycCertificate.js";
import { createZkKycInput } from "../support/fixtures.js";
import {
    assertLocalAztecNodeAvailable,
    createCertificateRegistryIntegrationHarness,
    useGuardianEnvLifecycle,
} from "../support/integrationHarness.js";

describe("issueKycCertificate integration", () => {
    useGuardianEnvLifecycle();

    it("issues a KYC certificate and returns its generated identifiers", async () => {
        await assertLocalAztecNodeAvailable();
        const harness = await createCertificateRegistryIntegrationHarness();

        const result = await issueKycCertificate({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
            ...harness.registryOptions,
            kyc: createZkKycInput({
                userAddress: harness.userAccount.address.toString(),
            }),
        });

        expect(result.guardianAddress.toString()).toBe(harness.guardianAccount.address.toString());
        expect(result.userAddress.toString()).toBe(harness.userAccount.address.toString());
        expect(result.uniqueId).toBeGreaterThan(0n);
        expect(result.revocationId).toBeGreaterThan(0n);

        await expect(
            harness.certificateRegistry.methods.get_certificate_count(harness.userAccount.address).simulate({
                from: harness.userAccount.address,
            })
        ).resolves.toEqual(expect.objectContaining({ result: 1n }));
    });
});
