import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { buildSponsoredSendOptions, requireTransactionHash } from "../../src/tx/guardianTx.js";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";

describe("guardian tx helpers", () => {
    it("builds sponsored send options from the network config", () => {
        const network = resolveNetworkConfig({ aztecEnv: "local-network" });

        expect(buildSponsoredSendOptions(AztecAddress.ZERO, { kind: "sponsored" }, network)).toEqual({
            from: AztecAddress.ZERO,
            fee: { paymentMethod: { kind: "sponsored" } },
            wait: { timeout: network.txTimeoutMs, returnReceipt: true },
        });
    });

    it("fails loudly when a transaction hash is missing", () => {
        expect(() => requireTransactionHash({}, "Certificate issuance")).toThrow(
            "Certificate issuance did not return a transaction hash"
        );
    });
});
