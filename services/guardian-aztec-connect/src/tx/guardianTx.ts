import { NO_FROM } from "@aztec/aztec.js/account";
import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { GuardianNetworkConfig } from "../types.js";

export interface GuardianSendOptions {
    from: AztecAddress | typeof NO_FROM;
    fee?: {
        paymentMethod: unknown;
    };
    wait: {
        timeout: number;
    };
}

interface TxHashLike {
    toString(): string;
}

interface ReceiptLike {
    txHash?: string | TxHashLike;
}

/**
 * Builds the common send options used by guardian write operations.
 *
 * - For environments with a Sponsored FPC, pass a `paymentMethod` (e.g. `SponsoredFeePaymentMethod`).
 * - For testnet / mainnet, omit `paymentMethod` to use the wallet's default fee mechanism.
 */
export function buildGuardianSendOptions(
    from: AztecAddress | typeof NO_FROM,
    paymentMethod: unknown | undefined,
    network: GuardianNetworkConfig
): GuardianSendOptions {
    const base: GuardianSendOptions = {
        from,
        wait: {
            timeout: network.txTimeoutMs,
        },
    };

    return paymentMethod ? { ...base, fee: { paymentMethod } } : base;
}

/**
 * Backwards-compatible alias (internal tests import this symbol).
 * Prefer `buildGuardianSendOptions`.
 */
export const buildSponsoredSendOptions = buildGuardianSendOptions;

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
