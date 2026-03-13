import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import type { AccountManager } from "@aztec/aztec.js/wallet";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { issueKycCertificate } from "../../src/issuance/issueKycCertificate.js";
import { listRevokableCertificates } from "../../src/certificates/listRevokableCertificates.js";
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

describe("listRevokableCertificates integration", () => {
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

    it("lists the guardian certificate copies after issuance", async () => {
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

        const listed = await listRevokableCertificates({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
            certificateRegistryAddress: certificateRegistryInstance.address,
            certificateRegistryAdminAddress: adminAccount.address,
            certificateRegistryDeploymentSalt: certificateRegistryInstance.salt.toString(),
            certificateRegistryDeployerAddress: adminAccount.address,
        });

        expect(listed.guardianAddress.toString()).toBe(guardianAccount.address.toString());
        expect(listed.count).toBe(1);
        expect(listed.certificates).toEqual([
            {
                guardianAddress: listed.guardianAddress,
                uniqueId: issued.uniqueId,
                revocationId: issued.revocationId,
                contentType: 1n,
            },
        ]);
    });
});
