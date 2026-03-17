#!/usr/bin/env node
/**
 * Proxy CLI: forwards to the underlying `@galactica-net/guardian-aztec-connect` CLI.
 * Usage is the same as in guardian-aztec-connect, e.g. `yarn cli account status`, `yarn cli kyc revoke --revocation-id <id>`.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);

function getGuardianAztecConnectDir(): string {
    const currentFilePath = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFilePath);
    return path.resolve(currentDir, "../../guardian-aztec-connect");
}

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
