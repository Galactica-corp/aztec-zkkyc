import type {
    DeployGuardianAccountResult,
    GuardianAccountStatus,
    IssueKycCertificateResult,
    ListRevokableCertificatesResult,
    RevokeCertificateResult,
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

export function serializeListRevokableCertificatesResult(result: ListRevokableCertificatesResult) {
    return {
        ...result,
        guardianAddress: result.guardianAddress.toString(),
        certificates: result.certificates.map((certificate) => ({
            ...certificate,
            guardianAddress: certificate.guardianAddress.toString(),
            uniqueId: certificate.uniqueId.toString(),
            revocationId: certificate.revocationId.toString(),
            contentType: certificate.contentType.toString(),
        })),
        network: {
            ...result.network,
        },
    };
}

export function formatListRevokableCertificatesResult(result: ListRevokableCertificatesResult): string {
    const lines = [
        `Network: ${result.network.name}`,
        `Guardian address: ${result.guardianAddress.toString()}`,
        `Revokable certificate count: ${result.count}`,
    ];

    if (result.certificates.length === 0) {
        lines.push("No revokable certificates found.");
        return lines.join("\n");
    }

    result.certificates.forEach((certificate, index) => {
        lines.push(`[${index}] Unique ID: ${certificate.uniqueId.toString()}`);
        lines.push(`[${index}] Revocation ID: ${certificate.revocationId.toString()}`);
        lines.push(`[${index}] Content type: ${certificate.contentType.toString()}`);
    });

    return lines.join("\n");
}

export function serializeRevokeCertificateResult(result: RevokeCertificateResult) {
    return {
        ...result,
        guardianAddress: result.guardianAddress.toString(),
        revocationId: result.revocationId.toString(),
        network: {
            ...result.network,
        },
    };
}

export function formatRevokeCertificateResult(result: RevokeCertificateResult): string {
    return [
        `Network: ${result.network.name}`,
        `Guardian address: ${result.guardianAddress.toString()}`,
        `Revocation ID: ${result.revocationId.toString()}`,
        `Transaction hash: ${result.txHash}`,
    ].join("\n");
}
