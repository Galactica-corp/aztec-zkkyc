#!/usr/bin/env node
/**
 * Ops CLI for guardian backend: status (guardian readiness), revoke (by revocation ID).
 * Uses the same Aztec adapter as the server; load .env before running.
 */
import "dotenv/config";

const args = process.argv.slice(2);
const command = args[0];
const help = `
Usage: yarn cli -- <command> [options]

Commands:
  status              Check guardian account and whitelist readiness (requires Aztec env).
  revoke <revocationId>   Revoke a certificate by its revocation ID (requires Aztec env).

Environment: Load from .env (see .env.example). For status/revoke, Aztec and guardian secrets are required.
`.trim();

async function runStatus(): Promise<void> {
    const { runPreflight } = await import("./aztec/guardianAztecAdapter.js");
    const status = await runPreflight();
    console.log("Guardian status: OK");
    console.log("  Contract initialized:", status.isContractInitialized);
    console.log("  Whitelisted:", status.isWhitelisted);
    if (status.whitelistStatusError) {
        console.log("  Whitelist note:", status.whitelistStatusError);
    }
}

async function runRevoke(revocationIdStr: string): Promise<void> {
    const id = revocationIdStr.trim();
    if (!id) {
        console.error("Missing revocation ID. Usage: yarn cli -- revoke <revocationId>");
        process.exit(1);
    }
    const revocationId = BigInt(id);
    const { guardianAztecAdapter } = await import("./aztec/guardianAztecAdapter.js");
    const result = await guardianAztecAdapter.revoke(revocationId);
    console.log("Revoked. txHash:", result.txHash);
}

async function main(): Promise<void> {
    if (!command || command === "--help" || command === "-h") {
        console.log(help);
        return;
    }
    try {
        if (command === "status") {
            await runStatus();
            return;
        }
        if (command === "revoke") {
            await runRevoke(args[1] ?? "");
            return;
        }
        console.error("Unknown command:", command);
        console.log(help);
        process.exit(1);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(message);
        process.exit(1);
    }
}

main();
