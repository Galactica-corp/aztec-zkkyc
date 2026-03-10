import { getGuardianAccountStatus } from "../wallet/accountStatus.js";
import { deployGuardianAccountIfNeeded } from "../wallet/deployAccount.js";
import type {
    DeployGuardianAccountResult,
    GuardianAccountStatus,
    GuardianWalletSetupOptions,
} from "../types.js";

export type GuardianCliCommandResult = GuardianAccountStatus | DeployGuardianAccountResult;

export interface GuardianCliCommand {
    key: string;
    usage: string;
    execute(options: GuardianWalletSetupOptions): Promise<GuardianCliCommandResult>;
}

const guardianCliCommands: Record<string, GuardianCliCommand> = {
    "account status": {
        key: "account status",
        usage: "guardian-aztec-connect account status [--network <name>] [--json]",
        execute: getGuardianAccountStatus,
    },
    "account deploy": {
        key: "account deploy",
        usage: "guardian-aztec-connect account deploy [--network <name>] [--json]",
        execute: deployGuardianAccountIfNeeded,
    },
};

export function getGuardianCliCommand(commandKey: string): GuardianCliCommand | undefined {
    return guardianCliCommands[commandKey];
}

export function listGuardianCliCommands(): GuardianCliCommand[] {
    return Object.values(guardianCliCommands);
}
