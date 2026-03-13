import { issueKycCertificate } from "../../src/issuance/issueKycCertificate.js";
import { listRevokableCertificates } from "../../src/certificates/listRevokableCertificates.js";
import { createZkKycInput } from "../support/fixtures.js";
import {
    assertLocalAztecNodeAvailable,
    createCertificateRegistryIntegrationHarness,
    useGuardianEnvLifecycle,
} from "../support/integrationHarness.js";

describe("listRevokableCertificates integration", () => {
    useGuardianEnvLifecycle();

    it("lists the guardian certificate copies after issuance", async () => {
        await assertLocalAztecNodeAvailable();
        const harness = await createCertificateRegistryIntegrationHarness();

        const issued = await issueKycCertificate({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
            ...harness.registryOptions,
            kyc: createZkKycInput({
                userAddress: harness.userAccount.address.toString(),
            }),
        });

        const listed = await listRevokableCertificates({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
            ...harness.registryOptions,
        });

        expect(listed.guardianAddress.toString()).toBe(harness.guardianAccount.address.toString());
        expect(listed.count).toBe(1);
        expect(listed.certificates).toEqual([
            {
                uniqueId: issued.uniqueId,
                revocationId: issued.revocationId,
                contentType: 1n,
            },
        ]);
    });
});
