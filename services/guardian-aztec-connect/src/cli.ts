import { getGuardianCliCommand, listGuardianCliCommands } from "./cli/commands.js";
import { formatCliResult, serializeCliResult } from "./cli/output.js";
import type { GuardianWalletSetupOptions } from "./types.js";

function getUsage(): string {
    return [
        "Usage:",
        ...listGuardianCliCommands().map((command) => `  ${command.usage}`),
    ].join("\n");
}

function parseOptions(argv: string[]): { commandKey: string; options: GuardianWalletSetupOptions; json: boolean } {
    const commandKey = argv.slice(0, 2).join(" ").trim();
    if (!getGuardianCliCommand(commandKey)) {
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
        commandKey,
        json,
        options: {
            aztecEnv,
        },
    };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
        console.log(getUsage());
        return;
    }

    const { commandKey, options, json } = parseOptions(argv);
    const command = getGuardianCliCommand(commandKey);
    if (!command) {
        throw new Error(getUsage());
    }
    const result = await command.execute(options);

    if (json) {
        console.log(JSON.stringify(serializeCliResult(result), null, 2));
        return;
    }

    console.log(formatCliResult(result));
}

const invokedAsEntrypoint = /\/cli\.(ts|js)$/.test(process.argv[1] ?? "");

if (invokedAsEntrypoint) {
    main().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
    });
}
