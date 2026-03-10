import { deployGuardianAccountIfNeeded, getGuardianAccountStatus } from "./index.js";
import type { DeployGuardianAccountResult, GuardianAccountStatus, GuardianWalletSetupOptions } from "./types.js";

function getUsage(): string {
    return [
        "Usage:",
        "  guardian-aztec-connect account status [--network <name>] [--json]",
        "  guardian-aztec-connect account deploy [--network <name>] [--json]",
    ].join("\n");
}

function parseOptions(argv: string[]): { command: "status" | "deploy"; options: GuardianWalletSetupOptions; json: boolean } {
    if (argv[0] !== "account") {
        throw new Error(getUsage());
    }

    const command = argv[1];
    if (command !== "status" && command !== "deploy") {
        throw new Error(getUsage());
    }

    let json = false;
    let aztecEnv: string | undefined;

    for (let index = 2; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--json") {
            json = true;
            continue;
        }

        if (argument === "--network") {
            aztecEnv = argv[index + 1];
            if (!aztecEnv) {
                throw new Error("Missing value for --network");
            }

            index += 1;
            continue;
        }

        throw new Error(`Unknown argument: ${argument}\n\n${getUsage()}`);
    }

    return {
        command,
        json,
        options: {
            aztecEnv,
        },
    };
}

function serializeResult(result: GuardianAccountStatus | DeployGuardianAccountResult) {
    return {
        ...result,
        address: result.address.toString(),
        network: {
            ...result.network,
        },
    };
}

function formatResult(result: GuardianAccountStatus | DeployGuardianAccountResult): string {
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

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
        console.log(getUsage());
        return;
    }

    const { command, options, json } = parseOptions(argv);
    const result = command === "status"
        ? await getGuardianAccountStatus(options)
        : await deployGuardianAccountIfNeeded(options);

    if (json) {
        console.log(JSON.stringify(serializeResult(result), null, 2));
        return;
    }

    console.log(formatResult(result));
}

const invokedAsEntrypoint = /\/cli\.(ts|js)$/.test(process.argv[1] ?? "");

if (invokedAsEntrypoint) {
    main().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
    });
}
