import { issueKycCertificate } from "../../src/issuance/issueKycCertificate.js";
import { listRevokableCertificates } from "../../src/certificates/listRevokableCertificates.js";
import { revokeCertificate } from "../../src/revocation/revokeCertificate.js";
import { createZkKycInput } from "../support/fixtures.js";
import {
  assertLocalAztecNodeAvailable,
  createCertificateRegistryIntegrationHarness,
  useGuardianEnvLifecycle,
} from "../support/integrationHarness.js";

describe("revokeCertificate integration", () => {
  useGuardianEnvLifecycle();

  it("revokes a certificate by revocation ID and removes it from the guardian copy list", async () => {
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

    const preList = await listRevokableCertificates({
      aztecEnv: "local-network",
      ephemeral: true,
      registerInitialAccounts: false,
      ...harness.registryOptions,
    });

    await expect(listRevokableCertificates({
      aztecEnv: "local-network",
      ephemeral: true,
      registerInitialAccounts: false,
      ...harness.registryOptions,
    })).resolves.toMatchObject({
      count: 1,
    });

    const revoked = await revokeCertificate(
      {
        aztecEnv: "local-network",
        ephemeral: true,
        registerInitialAccounts: false,
        ...harness.registryOptions,
        revocationId: issued.revocationId,
      },
    ).catch((err: unknown) => {
      throw err;
    });

    expect(revoked.guardianAddress.toString()).toBe(harness.guardianAccount.address.toString());
    expect(revoked.revocationId).toBe(issued.revocationId);
    expect(revoked.txHash).toBeTruthy();

    const postList = await listRevokableCertificates({
      aztecEnv: "local-network",
      ephemeral: true,
      registerInitialAccounts: false,
      ...harness.registryOptions,
    });

    await expect(listRevokableCertificates({
      aztecEnv: "local-network",
      ephemeral: true,
      registerInitialAccounts: false,
      ...harness.registryOptions,
    })).resolves.toEqual({
      guardianAddress: harness.guardianAccount.address,
      network: expect.any(Object),
      count: 0,
      certificates: [],
    });
  });
});
