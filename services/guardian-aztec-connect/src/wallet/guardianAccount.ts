import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import type { AccountManager } from "@aztec/aztec.js/wallet";
import type { EmbeddedWallet } from "@aztec/wallets/embedded";
import * as dotenv from "dotenv";
import path from "path";

export interface GuardianAccountSecrets {
    secret: Fr;
    signingKey: GrumpkinScalar;
    salt: Fr;
}

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

function readRequiredValue(env: NodeJS.ProcessEnv, key: "SECRET" | "SIGNING_KEY" | "SALT"): string {
    const value = env[key];
    if (!value) {
        throw new Error(`${key} environment variable is required`);
    }

    return value;
}

export function readGuardianAccountSecrets(env: NodeJS.ProcessEnv = process.env): GuardianAccountSecrets {
    try {
        return {
            secret: Fr.fromString(readRequiredValue(env, "SECRET")),
            signingKey: GrumpkinScalar.fromString(readRequiredValue(env, "SIGNING_KEY")),
            salt: Fr.fromString(readRequiredValue(env, "SALT")),
        };
    } catch (error) {
        if (error instanceof Error && error.message.includes("environment variable is required")) {
            throw error;
        }

        throw new Error("Guardian account env values must be valid Aztec field strings");
    }
}

export async function createGuardianAccount(wallet: EmbeddedWallet, env: NodeJS.ProcessEnv = process.env): Promise<AccountManager> {
    const { secret, salt, signingKey } = readGuardianAccountSecrets(env);

    return await wallet.createSchnorrAccount(secret, salt, signingKey);
}
