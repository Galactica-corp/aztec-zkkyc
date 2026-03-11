import { Fr } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { ContractArtifact } from "@aztec/aztec.js/abi";
import {
    createCertificateRegistryClientFromRuntime,
    ensureCertificateRegistryContractRegistered,
    getGuardianWhitelistStatus,
    issueCertificate,
    isGuardianInWhitelist,
    resolveCertificateRegistryRegistration,
    resolveCertificateRegistryAddress,
    type CertificateRegistryContractInstance,
} from "../../src/contracts/certificateRegistryClient.js";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import type { GuardianRuntime } from "../../src/types.js";
import { createAddressStub } from "../support/fixtures.js";

describe("certificateRegistryClient", () => {
    it("loads the certificate registry address from config", () => {
        const address = resolveCertificateRegistryAddress({
            certificateRegistryAddress: AztecAddress.ZERO.toString(),
        });

        expect(address.toString()).toBe(AztecAddress.ZERO.toString());
    });

    it("creates a registry client from the shared guardian runtime", async () => {
        const runtime = {
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
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

    it("submits the issue_certificate call through the registry client", async () => {
        const userAddress = AztecAddress.fromField(new Fr(17n));
        const client = {
            contract: {
                methods: {
                    issue_certificate(...args: unknown[]) {
                        expect(args).toHaveLength(6);
                        expect((args[0] as AztecAddress).toString()).toBe(userAddress.toString());
                        expect((args[1] as Fr).toBigInt()).toBe(111n);
                        expect((args[2] as Fr).toBigInt()).toBe(222n);

                        return {
                            async send(options: unknown) {
                                expect(options).toEqual({ from: "guardian" });
                                return {
                                    txHash: {
                                        toString() {
                                            return "0xtxhash";
                                        },
                                    },
                                };
                            },
                        };
                    },
                },
            },
        } as unknown as Awaited<ReturnType<typeof createCertificateRegistryClientFromRuntime>>;

        await expect(issueCertificate(client, {
            userAddress,
            uniqueId: new Fr(111),
            revocationId: new Fr(222),
            contentType: new Fr(1),
            personalData: [new Fr(1), new Fr(2), new Fr(3), new Fr(4), new Fr(5), new Fr(6), new Fr(0)],
            addressData: [new Fr(7), new Fr(8), new Fr(9), new Fr(10), new Fr(11), new Fr(0), new Fr(0)],
        }, { from: "guardian" })).resolves.toEqual({
            txHash: "0xtxhash",
        });
    });

    it("resolves certificate registry reconstruction inputs from options and env", () => {
        const runtime = {
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
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
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
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
