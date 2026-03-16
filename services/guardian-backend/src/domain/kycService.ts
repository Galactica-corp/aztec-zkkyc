/**
 * KYC service interface: access token generation, encryption key attachment, webhook handling.
 * Implemented by Sumsub-backed service; stub used for HTTP contract tests.
 */
export interface KYCService {
    generateAccessToken(userId: string): Promise<string>;
    attachEncryptionPublicKey(applicantId: string, encryptionPublicKey: Uint8Array | string): Promise<void>;
    handleWebhook(expectedDigest: Uint8Array, digestAlgorithm: string, body: Uint8Array): Promise<void>;
}
