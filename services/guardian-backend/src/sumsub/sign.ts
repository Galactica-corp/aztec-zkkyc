import { createHmac } from "node:crypto";

/**
 * Generate HMAC signature for Sumsub API request (timestamp + method + uri + body).
 */
export function sign(
    secret: Uint8Array,
    timestamp: string,
    method: string,
    uri: string,
    body: Uint8Array | null
): string {
    const h = createHmac("sha256", Buffer.from(secret));
    const payload = timestamp + method + uri;
    h.update(payload, "utf8");
    if (body && body.length > 0) {
        h.update(Buffer.from(body));
    }
    return h.digest("hex");
}
