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
    ];

    if ("deployed" in result) {
        lines.push(`Deployment sent: ${result.deployed ? "yes" : "no"}`);
    }

    return lines.join("\n");
}
