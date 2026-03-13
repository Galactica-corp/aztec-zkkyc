import { beforeEach, afterEach } from "@jest/globals";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import type { AccountManager } from "@aztec/aztec.js/wallet";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import type { GuardianStatusOptions } from "../../src/types.js";
import { createGuardianAccount } from "../../src/wallet/guardianAccount.js";
import { createGuardianWallet } from "../../src/wallet/setupWallet.js";
import { getSponsoredFPCInstance } from "../../src/wallet/sponsoredFee.js";
import { createGuardianEnv, restoreProcessEnv } from "./fixtures.js";

interface CertificateRegistryContractLike {
    methods: {
        whitelist_guardian(guardian: AztecAddress): {
            send(options: unknown): Promise<unknown>;
        };
        get_certificate_count(owner: AztecAddress): {
            simulate(options: { from: AztecAddress }): Promise<bigint>;
        };
    };
}

export interface CertificateRegistryIntegrationHarness {
    wallet: Awaited<ReturnType<typeof createGuardianWallet>>;
    paymentMethod: SponsoredFeePaymentMethod;
    adminAccount: AccountManager;
    guardianAccount: AccountManager;
    userAccount: AccountManager;
    certificateRegistry: CertificateRegistryContractLike;
    registryOptions: Required<Pick<
        GuardianStatusOptions,
        | "certificateRegistryAddress"
        | "certificateRegistryAdminAddress"
        | "certificateRegistryDeploymentSalt"
        | "certificateRegistryDeployerAddress"
    >>;
}

export function useGuardianEnvLifecycle(): void {
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
}

export async function assertLocalAztecNodeAvailable(aztecEnv = "local-network"): Promise<void> {
    const network = resolveNetworkConfig({ aztecEnv });

    try {
        await fetch(network.nodeUrl, { method: "GET" });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
            `Local Aztec node is not reachable at ${network.nodeUrl}. Start it with "aztec start --local-network" before running integration tests. (${message})`
        );
    }
}

export async function deploySchnorrAccount(
    account: AccountManager,
    paymentMethod: SponsoredFeePaymentMethod
): Promise<void> {
    await (await account.getDeployMethod()).send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod },
        wait: { timeout: 60000, returnReceipt: true },
    });
}

export async function createCertificateRegistryIntegrationHarness(): Promise<CertificateRegistryIntegrationHarness> {
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

    return {
        wallet,
        paymentMethod,
        adminAccount,
        guardianAccount,
        userAccount,
        certificateRegistry,
        registryOptions: {
            certificateRegistryAddress: certificateRegistryInstance.address,
            certificateRegistryAdminAddress: adminAccount.address,
            certificateRegistryDeploymentSalt: certificateRegistryInstance.salt.toString(),
            certificateRegistryDeployerAddress: adminAccount.address,
        },
    };
}
