import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import type { AccountManager } from "@aztec/aztec.js/wallet";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { issueKycCertificate } from "../../src/issuance/issueKycCertificate.js";
import { listRevokableCertificates } from "../../src/certificates/listRevokableCertificates.js";
import { revokeCertificate } from "../../src/revocation/revokeCertificate.js";
import { createGuardianAccount } from "../../src/wallet/guardianAccount.js";
import { createGuardianWallet } from "../../src/wallet/setupWallet.js";
import { getSponsoredFPCInstance } from "../../src/wallet/sponsoredFee.js";
import { createGuardianEnv, createZkKycInput, restoreProcessEnv } from "../support/fixtures.js";

async function deploySchnorrAccount(
    account: AccountManager,
    paymentMethod: SponsoredFeePaymentMethod
): Promise<void> {
    await (await account.getDeployMethod()).send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod },
        wait: { timeout: 60000, returnReceipt: true },
    });
}

describe("revokeCertificate integration", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = {
            ...process.env,
            ...createGuardianEnv(),
        };
    });

    afterEach(() => {
        restoreProcessEnv(originalEnv);
    });

    it("revokes a certificate by revocation ID and removes it from the guardian copy list", async () => {
        const artifactModulePath = new URL("../../../../artifacts/CertificateRegistry.js", import.meta.url).href;
        const { CertificateRegistryContract } = await import(artifactModulePath);
        const wallet = await createGuardianWallet({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
        });
        const sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
        const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        const adminAccount = await wallet.createSchnorrAccount(Fr.random(), Fr.random(), GrumpkinScalar.random());
        const guardianAccount = await createGuardianAccount(wallet);
        const userAccount = await wallet.createSchnorrAccount(Fr.random(), Fr.random(), GrumpkinScalar.random());

        await deploySchnorrAccount(adminAccount, paymentMethod);
        await deploySchnorrAccount(guardianAccount, paymentMethod);
        await deploySchnorrAccount(userAccount, paymentMethod);

        const certificateDeployMethod = CertificateRegistryContract.deploy(wallet, adminAccount.address);
        await certificateDeployMethod.send({
            from: adminAccount.address,
            fee: { paymentMethod },
            wait: { timeout: 120000, returnReceipt: true },
        });
        const certificateRegistryInstance = await certificateDeployMethod.getInstance();
        if (!certificateRegistryInstance) {
            throw new Error("Certificate registry deployment did not return instantiation data");
        }
        const certificateRegistry = await CertificateRegistryContract.at(certificateRegistryInstance.address, wallet);

        await certificateRegistry.methods.whitelist_guardian(guardianAccount.address).send({
            from: adminAccount.address,
            fee: { paymentMethod },
            wait: { timeout: 60000, returnReceipt: true },
        });

        const issued = await issueKycCertificate({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
            certificateRegistryAddress: certificateRegistryInstance.address,
            certificateRegistryAdminAddress: adminAccount.address,
            certificateRegistryDeploymentSalt: certificateRegistryInstance.salt.toString(),
            certificateRegistryDeployerAddress: adminAccount.address,
            kyc: createZkKycInput({
                userAddress: userAccount.address.toString(),
            }),
        });

        await expect(listRevokableCertificates({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
            certificateRegistryAddress: certificateRegistryInstance.address,
            certificateRegistryAdminAddress: adminAccount.address,
            certificateRegistryDeploymentSalt: certificateRegistryInstance.salt.toString(),
            certificateRegistryDeployerAddress: adminAccount.address,
        })).resolves.toMatchObject({
            count: 1,
        });

        const revoked = await revokeCertificate({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
            certificateRegistryAddress: certificateRegistryInstance.address,
            certificateRegistryAdminAddress: adminAccount.address,
            certificateRegistryDeploymentSalt: certificateRegistryInstance.salt.toString(),
            certificateRegistryDeployerAddress: adminAccount.address,
            revocationId: issued.revocationId,
        });

        expect(revoked.guardianAddress.toString()).toBe(guardianAccount.address.toString());
        expect(revoked.revocationId).toBe(issued.revocationId);
        expect(revoked.txHash).toBeTruthy();

        await expect(listRevokableCertificates({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
            certificateRegistryAddress: certificateRegistryInstance.address,
            certificateRegistryAdminAddress: adminAccount.address,
            certificateRegistryDeploymentSalt: certificateRegistryInstance.salt.toString(),
            certificateRegistryDeployerAddress: adminAccount.address,
        })).resolves.toEqual({
            guardianAddress: guardianAccount.address,
            network: expect.any(Object),
            count: 0,
            certificates: [],
        });
    });
});
