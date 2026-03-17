#!/usr/bin/env node
/**
 * Proxy CLI: forwards to the underlying `@galactica-net/guardian-aztec-connect` CLI.
 * Usage is the same as in guardian-aztec-connect, e.g. `yarn cli account status`, `yarn cli kyc revoke --revocation-id <id>`.
 * Loads this package's .env first so backend config takes precedence over guardian-aztec-connect's .env in the child process.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

const args = process.argv.slice(2);

function getBackendRoot(): string {
    const currentFilePath = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFilePath);
    return path.resolve(currentDir, "..");
}

function getGuardianAztecConnectDir(): string {
    return path.resolve(getBackendRoot(), "../guardian-aztec-connect");
}

dotenv.config({ path: path.join(getBackendRoot(), ".env"), override: false });

const result = spawnSync("yarn", ["cli", "--", ...args], {
    cwd: getGuardianAztecConnectDir(),
    stdio: "inherit",
    env: process.env,
});

if (typeof result.status === "number") {
    process.exit(result.status);
}
if (result.error) {
    const message = result.error instanceof Error ? result.error.message : String(result.error);
    console.error(message);
}
process.exit(1);
