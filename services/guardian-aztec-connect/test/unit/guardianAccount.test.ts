import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { readGuardianAccountSecrets } from "../../src/wallet/guardianAccount.js";

describe("readGuardianAccountSecrets", () => {
    it("throws when SECRET is missing", () => {
        expect(() =>
            readGuardianAccountSecrets({
                SALT: Fr.random().toString(),
                SIGNING_KEY: GrumpkinScalar.random().toString(),
            })
        ).toThrow("SECRET environment variable is required");
    });

    it("parses the guardian Schnorr account material", () => {
        const secret = Fr.random();
        const salt = Fr.random();
        const signingKey = GrumpkinScalar.random();

        const secrets = readGuardianAccountSecrets({
            SECRET: secret.toString(),
            SALT: salt.toString(),
            SIGNING_KEY: signingKey.toString(),
        });

        expect(secrets.secret.toString()).toBe(secret.toString());
        expect(secrets.salt.toString()).toBe(salt.toString());
        expect(secrets.signingKey.toString()).toBe(signingKey.toString());
    });
});
