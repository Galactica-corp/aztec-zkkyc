import { createHmac } from "node:crypto";

/**
 * Verify Sumsub webhook digest. Supports HMAC_SHA256_HEX and HMAC_SHA512_HEX.
 */
export function verifyWebhookDigest(
    secret: Uint8Array,
    expected: Uint8Array,
    algorithm: string,
    data: Uint8Array
): boolean {
    const algo = algorithm.toUpperCase();
    let hashAlg: "sha256" | "sha512";
    if (algo === "HMAC_SHA256_HEX") {
        hashAlg = "sha256";
    } else if (algo === "HMAC_SHA512_HEX") {
        hashAlg = "sha512";
    } else {
        return false;
    }
    const h = createHmac(hashAlg, Buffer.from(secret));
    h.update(Buffer.from(data));
    const computed = h.digest();
    if (computed.length !== expected.length) return false;
    return timingSafeEqual(computed, Buffer.from(expected));
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    let out = 0;
    for (let i = 0; i < a.length; i++) {
        out |= a[i]! ^ b[i]!;
    }
    return out === 0;
}
