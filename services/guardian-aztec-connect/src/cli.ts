import { getGuardianCliCommand, listGuardianCliCommands } from "./cli/commands.js";
import type { GuardianWalletSetupOptions } from "./types.js";

function getUsage(): string {
    return [
        "Usage:",
        ...listGuardianCliCommands().map((command) => `  ${command.usage}`),
    ].join("\n");
}

export function parseOptions(argv: string[]): { commandKey: string; options: GuardianWalletSetupOptions; json: boolean } {
    const commandKey = argv.slice(0, 2).join(" ").trim();
    const command = getGuardianCliCommand(commandKey);
    if (!command) {
        throw new Error(getUsage());
    }

    try {
        const parsed = command.parse(argv.slice(2));

        return {
            commandKey,
            json: parsed.json,
            options: parsed.options,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${message}\n\n${getUsage()}`);
    }
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
        console.log(JSON.stringify(command.serialize(result), null, 2));
        return;
    }

    console.log(command.format(result));
}

const invokedAsEntrypoint = /\/cli\.(ts|js)$/.test(process.argv[1] ?? "");

if (invokedAsEntrypoint) {
    main().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
    });
}
