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

function extractTxHash(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const direct =
    record.txHash ??
    record.tx_hash ??
    record.hash ??
    record.transactionHash ??
    record.transaction_hash;

  if (typeof direct === "string") {
    return direct;
  }

  if (direct && typeof direct === "object") {
    const maybeToString = (direct as Record<string, unknown>).toString;
    if (typeof maybeToString === "function") {
      return (direct as TxHashLike).toString();
    }
  }

  for (const candidateName of ["getTxHash", "getHash", "getTransactionHash"]) {
    const candidate = record[candidateName];
    if (typeof candidate === "function") {
      try {
        const result = (candidate as () => unknown).call(value);
        const extracted = extractTxHash(result);
        if (extracted) {
          return extracted;
        }
      } catch {
        // Ignore and keep searching other shapes.
      }
    }
  }

  if ("receipt" in record) {
    return extractTxHash(record.receipt);
  }

  if ("result" in record) {
    return extractTxHash(record.result);
  }

  for (const nestedKey of ["tx", "transaction", "txResult", "txReceipt", "minedReceipt", "value"]) {
    if (nestedKey in record) {
      const extracted = extractTxHash(record[nestedKey]);
      if (extracted) {
        return extracted;
      }
    }
  }

  return undefined;
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
  const txHash = extractTxHash(receipt);
  if (!txHash) {
    throw new Error(`${action} did not return a transaction hash`);
  }

  return txHash;
}
