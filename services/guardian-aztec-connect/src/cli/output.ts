import type {
    DeployGuardianAccountResult,
    GuardianAccountStatus,
    IssueKycCertificateResult,
} from "../types.js";

export function serializeAccountResult(result: GuardianAccountStatus | DeployGuardianAccountResult) {
    return {
        ...result,
        address: result.address.toString(),
        network: {
            ...result.network,
        },
    };
}

export function formatAccountResult(result: GuardianAccountStatus | DeployGuardianAccountResult): string {
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

export function serializeIssueKycResult(result: IssueKycCertificateResult) {
    return {
        ...result,
        guardianAddress: result.guardianAddress.toString(),
        userAddress: result.userAddress.toString(),
        uniqueId: result.uniqueId.toString(),
        revocationId: result.revocationId.toString(),
        network: {
            ...result.network,
        },
    };
}

export function formatIssueKycResult(result: IssueKycCertificateResult): string {
    return [
        `Network: ${result.network.name}`,
        `Guardian address: ${result.guardianAddress.toString()}`,
        `User address: ${result.userAddress.toString()}`,
        `Unique ID: ${result.uniqueId.toString()}`,
        `Revocation ID: ${result.revocationId.toString()}`,
        `Transaction hash: ${result.txHash}`,
    ].join("\n");
}
