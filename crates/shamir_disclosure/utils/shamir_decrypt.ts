import { Fr } from "@aztec/aztec.js/fields";

export type ShardValue = bigint | number | string | Fr;

export type ShardPoint = {
  x: ShardValue;
  y: ShardValue;
};

const toBigInt = (value: ShardValue, label: string): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  if (value && typeof value === "object" && "toBigInt" in value) {
    return (value as { toBigInt: () => bigint }).toBigInt();
  }

  throw new Error(`Invalid ${label} value: ${String(value)}`);
};

const mod = (value: bigint, prime: bigint): bigint => {
  const result = value % prime;
  return result >= 0n ? result : result + prime;
};

const extendedGcd = (a: bigint, b: bigint): [bigint, bigint, bigint] => {
  let oldR = a;
  let r = b;
  let oldS = 1n;
  let s = 0n;
  let oldT = 0n;
  let t = 1n;

  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
    [oldT, t] = [t, oldT - quotient * t];
  }

  return [oldR, oldS, oldT];
};

const modInverse = (value: bigint, prime: bigint): bigint => {
  const [gcd, x] = extendedGcd(mod(value, prime), prime);
  if (gcd !== 1n) {
    throw new Error("Shard coordinates are invalid: denominator has no modular inverse.");
  }
  return mod(x, prime);
};

/**
 * Reconstructs the original Shamir secret from private shard points.
 *
 * This function performs Lagrange interpolation at `x = 0` in the Aztec field,
 * using the first `threshold_amount` points from `shard_list`.
 *
 * @param recipient_amount Total number of recipients that can hold shards.
 * Used for validation of x-coordinates (expected range: `1..recipient_amount`).
 * @param threshold_amount Minimum number of shards needed to reconstruct.
 * The function will use exactly this many points from `shard_list`.
 * @param shard_list Ordered shard points `{ x, y }`. Provide at least
 * `threshold_amount` distinct points; x/y values can be `Fr`, `bigint`,
 * `number`, or numeric `string`.
 * @returns Recovered secret as a field element represented as `bigint`.
 *
 * @example
 * ```ts
 * const secret = decryptShamirSecret(3, 2, [
 *   { x: 1n, y: 123n },
 *   { x: 2n, y: 456n },
 * ]);
 * ```
 */
export function decryptShamirSecret(
  recipient_amount: number,
  threshold_amount: number,
  shard_list: ShardPoint[]
): bigint {
  if (!Number.isInteger(recipient_amount) || recipient_amount <= 0) {
    throw new Error("recipient_amount must be a positive integer.");
  }
  if (!Number.isInteger(threshold_amount) || threshold_amount <= 0) {
    throw new Error("threshold_amount must be a positive integer.");
  }
  if (threshold_amount > recipient_amount) {
    throw new Error("threshold_amount cannot exceed recipient_amount.");
  }
  if (shard_list.length < threshold_amount) {
    throw new Error("Not enough shards provided for threshold decryption.");
  }

  const prime = Fr.MODULUS;
  const selected = shard_list.slice(0, threshold_amount);
  const seenX = new Set<bigint>();
  const points = selected.map((shard, idx) => {
    const x = toBigInt(shard.x, `shard_list[${idx}].x`);
    const y = mod(toBigInt(shard.y, `shard_list[${idx}].y`), prime);

    if (x <= 0n || x > BigInt(recipient_amount)) {
      throw new Error(
        `Shard x-coordinate ${x.toString()} is outside expected recipient range 1..${recipient_amount}.`
      );
    }
    if (seenX.has(x)) {
      throw new Error(`Duplicate shard x-coordinate detected: ${x.toString()}.`);
    }
    seenX.add(x);

    return { x, y };
  });

  let secret = 0n;
  for (let i = 0; i < points.length; i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    let numerator = 1n;
    let denominator = 1n;

    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const xj = points[j].x;
      numerator = mod(numerator * -xj, prime);
      denominator = mod(denominator * (xi - xj), prime);
    }

    const basisAtZero = mod(numerator * modInverse(denominator, prime), prime);
    secret = mod(secret + yi * basisAtZero, prime);
  }

  return secret;
}
