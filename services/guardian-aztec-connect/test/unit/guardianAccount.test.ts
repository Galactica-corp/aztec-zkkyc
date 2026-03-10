import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { readGuardianAccountSecrets } from "../../src/wallet/guardianAccount.js";
import { createGuardianEnv } from "../support/fixtures.js";

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
        const env = createGuardianEnv();
        const secrets = readGuardianAccountSecrets(env);

        expect(secrets.secret.toString()).toBe(env.SECRET);
        expect(secrets.salt.toString()).toBe(env.SALT);
        expect(secrets.signingKey.toString()).toBe(env.SIGNING_KEY);
    });
});
