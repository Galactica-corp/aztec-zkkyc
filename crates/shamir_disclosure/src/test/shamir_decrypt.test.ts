import { Fr } from "@aztec/aztec.js/fields";
import { decryptShamirSecret } from "../../utils/shamir_decrypt.js";

describe("decryptShamirSecret", () => {
    it("reconstructs a linear secret from a threshold subset", () => {
        const secret = 1234n;
        const coeff = 91n;

        const shardList = [
            { x: 1n, y: secret + coeff * 1n },
            { x: 2n, y: secret + coeff * 2n },
            { x: 3n, y: secret + coeff * 3n },
        ];

        expect(decryptShamirSecret(3, 2, [shardList[0], shardList[2]])).toBe(secret);
    });

    it("reconstructs a quadratic secret in field arithmetic", () => {
        const prime = Fr.MODULUS;
        const secret = 9999n;
        const coeff1 = 17n;
        const coeff2 = 33n;

        const shardList = [1n, 2n, 3n, 4n, 5n].map((x) => {
            const y = (secret + coeff1 * x + coeff2 * x * x) % prime;
            return { x: new Fr(x), y: new Fr(y) };
        });

        expect(decryptShamirSecret(5, 3, [shardList[1], shardList[3], shardList[4]])).toBe(secret);
    });

    it("throws when shard count is below threshold", () => {
        expect(() =>
            decryptShamirSecret(3, 2, [{ x: 1n, y: 10n }])
        ).toThrow("Not enough shards provided for threshold decryption.");
    });

    it("throws on duplicate shard x-coordinates", () => {
        expect(() =>
            decryptShamirSecret(3, 2, [
                { x: 1n, y: 10n },
                { x: 1n, y: 20n },
            ])
        ).toThrow("Duplicate shard x-coordinate detected: 1.");
    });

    it("throws on shard x outside recipient range", () => {
        expect(() =>
            decryptShamirSecret(3, 2, [
                { x: 1n, y: 10n },
                { x: 4n, y: 20n },
            ])
        ).toThrow("Shard x-coordinate 4 is outside expected recipient range 1..3.");
    });
});
