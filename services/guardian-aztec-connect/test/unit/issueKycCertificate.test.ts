import path from "path";
import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Fr } from "@aztec/aztec.js/fields";
import { loadKycInputFromFile } from "../../src/cli/loadKycInput.js";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import {
    issueKycCertificateFromDependencies,
    type PreparedKycCertificateIssuance,
} from "../../src/issuance/issueKycCertificate.js";
import { createAddressStub } from "../support/fixtures.js";

const exampleKycPath = path.resolve(process.cwd(), "examples/kyc.json");

describe("issueKycCertificateFromDependencies", () => {
    it("submits the prepared certificate with sponsored fee payment and returns the IDs", async () => {
        const network = resolveNetworkConfig({ aztecEnv: "local-network" });
        const guardianAddress = createAddressStub("0xguardian") as AztecAddress;
        const userAddress = createAddressStub("0xuser") as AztecAddress;
        const exampleKyc = loadKycInputFromFile(exampleKycPath);
        const preparedIssuance: PreparedKycCertificateIssuance = {
            userAddress,
            uniqueId: new Fr(111),
            revocationId: new Fr(222),
            contentType: new Fr(1),
            personalData: [new Fr(1), new Fr(2), new Fr(3), new Fr(4), new Fr(5), new Fr(6), new Fr(0)],
            addressData: [new Fr(7), new Fr(8), new Fr(9), new Fr(10), new Fr(11), new Fr(0), new Fr(0)],
        };
        const sentRequests: unknown[] = [];
        const sendOptions: unknown[] = [];

        const result = await issueKycCertificateFromDependencies({
            network,
            account: { address: guardianAddress },
            paymentMethod: { kind: "sponsored" },
            kyc: exampleKyc,
            async prepareIssuance() {
                return preparedIssuance;
            },
            async submitIssuance(request, options) {
                sentRequests.push(request);
                sendOptions.push(options);

                return { txHash: "0xtxhash" };
            },
        });

        expect(sentRequests).toEqual([preparedIssuance]);
        expect(sendOptions).toEqual([{
            from: guardianAddress,
            fee: { paymentMethod: { kind: "sponsored" } },
            wait: { timeout: network.txTimeoutMs, returnReceipt: true },
        }]);
        expect(result.guardianAddress).toBe(guardianAddress);
        expect(result.userAddress).toBe(userAddress);
        expect(result.uniqueId).toBe(111n);
        expect(result.revocationId).toBe(222n);
        expect(result.txHash).toBe("0xtxhash");
    });
});
