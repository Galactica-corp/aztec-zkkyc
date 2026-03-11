import { Fr } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { ContractArtifact } from "@aztec/aztec.js/abi";
import {
    createCertificateRegistryClientFromRuntime,
    ensureCertificateRegistryContractRegistered,
    getGuardianWhitelistStatus,
    isGuardianInWhitelist,
    resolveCertificateRegistryRegistration,
    resolveCertificateRegistryAddress,
    type CertificateRegistryContractInstance,
} from "../../src/contracts/certificateRegistryClient.js";
import type { GuardianRuntime } from "../../src/types.js";
import { createAddressStub, getLocalNetworkConfig } from "../support/fixtures.js";

describe("certificateRegistryClient", () => {
    it("loads the certificate registry address from config", () => {
        const address = resolveCertificateRegistryAddress({
            certificateRegistryAddress: AztecAddress.ZERO.toString(),
        });

        expect(address.toString()).toBe(AztecAddress.ZERO.toString());
    });

    it("creates a registry client from the shared guardian runtime", async () => {
        const runtime = {
            network: getLocalNetworkConfig(),
            wallet: ({
                pxe: {
                    async getContractInstance() {
                        return { alreadyRegistered: true };
                    },
                },
            } as unknown) as GuardianRuntime["wallet"],
            account: {
                address: createAddressStub(),
            } as GuardianRuntime["account"],
        } as GuardianRuntime;
        const contract = { id: "registry-contract" } as unknown as CertificateRegistryContractInstance;

        const client = await createCertificateRegistryClientFromRuntime(
            runtime,
            { certificateRegistryAddress: AztecAddress.ZERO },
            {
                async loadArtifact() {
                    return { name: "CertificateRegistry" } as ContractArtifact;
                },
                async loadContract(address, passedRuntime) {
                    expect(address.toString()).toBe(AztecAddress.ZERO.toString());
                    expect(passedRuntime).toBe(runtime);
                    return contract;
                },
            }
        );

        expect(client.address.toString()).toBe(AztecAddress.ZERO.toString());
        expect(client.runtime).toBe(runtime);
        expect(client.contract).toBe(contract);
    });

    it("checks whether a guardian address is present in the whitelist entries", () => {
        const guardianAddress = AztecAddress.fromField(new Fr(7n));
        const otherAddress = AztecAddress.fromField(new Fr(9n));

        expect(isGuardianInWhitelist(guardianAddress, [0n, 7n, 0n])).toBe(true);
        expect(isGuardianInWhitelist(otherAddress, [0n, 7n, 0n])).toBe(false);
    });

    it("reads the whitelist getter from the certificate registry client", async () => {
        const guardianAddress = AztecAddress.fromField(new Fr(11n));
        const client = {
            contract: {
                methods: {
                    get_whitelisted_guardians() {
                        return {
                            async simulate() {
                                return [0n, 11n, 13n];
                            },
                        };
                    },
                },
            },
        } as unknown as Awaited<ReturnType<typeof createCertificateRegistryClientFromRuntime>>;

        await expect(getGuardianWhitelistStatus(client, guardianAddress)).resolves.toBe(true);
        await expect(
            getGuardianWhitelistStatus(client, AztecAddress.fromField(new Fr(15n)))
        ).resolves.toBe(false);
    });

    it("resolves certificate registry reconstruction inputs from options and env", () => {
        const runtime = {
            network: getLocalNetworkConfig(),
            wallet: {} as GuardianRuntime["wallet"],
            account: {
                address: AztecAddress.fromField(new Fr(31n)),
            } as GuardianRuntime["account"],
        } as GuardianRuntime;

        const registration = resolveCertificateRegistryRegistration(
            {},
            runtime,
            {
                CERTIFICATE_REGISTRY_ADMIN_ADDRESS: AztecAddress.fromField(new Fr(32n)).toString(),
                CERTIFICATE_REGISTRY_DEPLOYMENT_SALT: new Fr(33n).toString(),
            }
        );

        expect(registration?.adminAddress.toString()).toBe(AztecAddress.fromField(new Fr(32n)).toString());
        expect(registration?.deployerAddress.toString()).toBe(runtime.account.address.toString());
        expect(registration?.deploymentSalt.toString()).toBe(new Fr(33n).toString());
    });

    it("registers the certificate registry in PXE from contract metadata when missing", async () => {
        const address = AztecAddress.fromField(new Fr(21n));
        const instance = { address } as unknown as Awaited<
            ReturnType<NonNullable<GuardianRuntime["wallet"]["getContractMetadata"]>>
        >["instance"];
        const runtime = {
            network: getLocalNetworkConfig(),
            account: {
                address: createAddressStub(),
            } as GuardianRuntime["account"],
            wallet: {
                pxe: {
                    async getContractInstance() {
                        return undefined;
                    },
                },
                async getContractMetadata() {
                    return {
                        instance,
                        isContractInitialized: true,
                    };
                },
                async registerContract(passedInstance: unknown, artifact: ContractArtifact) {
                    expect(passedInstance).toBe(instance);
                    expect(artifact.name).toBe("CertificateRegistry");
                    return passedInstance;
                },
            } as unknown as GuardianRuntime["wallet"],
        } as GuardianRuntime;

        await expect(
            ensureCertificateRegistryContractRegistered(runtime, address, {
                name: "CertificateRegistry",
            } as ContractArtifact)
        ).resolves.toBeUndefined();
    });
});
