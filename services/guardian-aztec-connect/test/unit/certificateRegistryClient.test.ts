import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    createCertificateRegistryClientFromRuntime,
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
            wallet: {} as GuardianRuntime["wallet"],
            account: {
                address: createAddressStub(),
            } as GuardianRuntime["account"],
        } as GuardianRuntime;
        const contract = { id: "registry-contract" } as unknown as CertificateRegistryContractInstance;

        const client = await createCertificateRegistryClientFromRuntime(
            runtime,
            { certificateRegistryAddress: AztecAddress.ZERO },
            {
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
});
