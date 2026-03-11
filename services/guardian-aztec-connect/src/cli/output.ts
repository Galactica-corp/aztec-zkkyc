import type { DeployGuardianAccountResult, GuardianAccountStatus } from "../types.js";

export type GuardianCliOutputResult = GuardianAccountStatus | DeployGuardianAccountResult;

export function serializeCliResult(result: GuardianCliOutputResult) {
    return {
        ...result,
        address: result.address.toString(),
        network: {
            ...result.network,
        },
    };
}

export function formatCliResult(result: GuardianCliOutputResult): string {
    const lines = [
        `Network: ${result.network.name}`,
        `Node URL: ${result.network.nodeUrl}`,
        `Address: ${result.address.toString()}`,
        `Registered in wallet: ${result.isRegisteredInWallet ? "yes" : "no"}`,
        `Contract initialized: ${result.isContractInitialized ? "yes" : "no"}`,
        `Guardian whitelisted: ${
            result.isWhitelisted === null ? "unavailable" : result.isWhitelisted ? "yes" : "no"
        }`,
    ];

    if (result.whitelistStatusError) {
        lines.push(`Whitelist status check failed: ${result.whitelistStatusError}`);
    } else if (result.isWhitelisted === false) {
        lines.push("Contact the Galactica team to get this guardian whitelisted.");
    }

    if ("deployed" in result) {
        lines.push(`Deployment sent: ${result.deployed ? "yes" : "no"}`);
    }

    return lines.join("\n");
}
