import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { GuardianNetworkConfig } from "../types.js";

export interface GuardianSendOptions {
    from: AztecAddress;
    fee: {
        paymentMethod: unknown;
    };
    wait: {
        timeout: number;
        returnReceipt: true;
    };
}

interface TxHashLike {
    toString(): string;
}

interface ReceiptLike {
    txHash?: string | TxHashLike;
}

/**
 * Builds the common sponsored send options used by guardian write operations.
 */
export function buildSponsoredSendOptions(
    from: AztecAddress,
    paymentMethod: unknown,
    network: GuardianNetworkConfig
): GuardianSendOptions {
    return {
        from,
        fee: { paymentMethod },
        wait: {
            timeout: network.txTimeoutMs,
            returnReceipt: true,
        },
    };
}

/**
 * Extracts a transaction hash from an Aztec receipt and fails loudly when it is missing.
 */
export function requireTransactionHash(receipt: ReceiptLike | undefined, action: string): string {
    const txHash = typeof receipt?.txHash === "string" ? receipt.txHash : receipt?.txHash?.toString();
    if (!txHash) {
        throw new Error(`${action} did not return a transaction hash`);
    }

    return txHash;
}
