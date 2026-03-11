import { issueKycCertificate } from "../issuance/issueKycCertificate.js";
import { loadKycInputFromFile } from "./loadKycInput.js";
import { getGuardianAccountStatus } from "../wallet/accountStatus.js";
import { deployGuardianAccountIfNeeded } from "../wallet/deployAccount.js";
import type {
    DeployGuardianAccountResult,
    GuardianAccountStatus,
    GuardianWalletSetupOptions,
    IssueKycCertificateResult,
} from "../types.js";

export type GuardianCliCommandResult =
    | GuardianAccountStatus
    | DeployGuardianAccountResult
    | IssueKycCertificateResult;

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
    "kyc issue": {
        key: "kyc issue",
        usage: "guardian-aztec-connect kyc issue --input <file> [--network <name>] [--json]",
        async execute(options) {
            if (!options.inputPath) {
                throw new Error("Missing value for --input");
            }

            return await issueKycCertificate({
                aztecEnv: options.aztecEnv,
                kyc: loadKycInputFromFile(options.inputPath),
            });
        },
    },
};

export function getGuardianCliCommand(commandKey: string): GuardianCliCommand | undefined {
    return guardianCliCommands[commandKey];
}

export function listGuardianCliCommands(): GuardianCliCommand[] {
    return Object.values(guardianCliCommands);
}
