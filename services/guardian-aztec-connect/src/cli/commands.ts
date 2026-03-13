import { issueKycCertificate } from "../issuance/issueKycCertificate.js";
import { listRevokableCertificates } from "../certificates/listRevokableCertificates.js";
import { revokeCertificate } from "../revocation/revokeCertificate.js";
import type {
    DeployGuardianAccountResult,
    GuardianCliBaseOptions,
    GuardianAccountStatus,
    IssueKycCliOptions,
    IssueKycCertificateResult,
    ListRevokableCertificatesResult,
    RevokeCertificateCliOptions,
    RevokeCertificateResult,
} from "../types.js";
import { getGuardianAccountStatus } from "../wallet/accountStatus.js";
import { deployGuardianAccountIfNeeded } from "../wallet/deployAccount.js";
import {
    formatAccountResult,
    formatIssueKycResult,
    formatListRevokableCertificatesResult,
    formatRevokeCertificateResult,
    serializeAccountResult,
    serializeIssueKycResult,
    serializeListRevokableCertificatesResult,
    serializeRevokeCertificateResult,
} from "./output.js";
import { loadKycInputFromFile } from "./loadKycInput.js";

export type GuardianCliCommandResult =
    | GuardianAccountStatus
    | DeployGuardianAccountResult
    | IssueKycCertificateResult
    | ListRevokableCertificatesResult
    | RevokeCertificateResult;

export interface ParsedGuardianCliCommand<TOptions extends object> {
    json: boolean;
    options: TOptions;
}

export interface GuardianCliCommand<TOptions extends object = GuardianCliBaseOptions, TResult = GuardianCliCommandResult> {
    key: string;
    usage: string;
    parse(args: string[]): ParsedGuardianCliCommand<TOptions>;
    execute(options: TOptions): Promise<TResult>;
    format(result: TResult): string;
    serialize(result: TResult): unknown;
}

function parseNetworkJsonFlags(args: string[]): ParsedGuardianCliCommand<GuardianCliBaseOptions> {
    let json = false;
    let aztecEnv: string | undefined;

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--json") {
            json = true;
            continue;
        }

        if (argument === "--network") {
            aztecEnv = args[index + 1];
            if (!aztecEnv) {
                throw new Error("Missing value for --network");
            }

            index += 1;
            continue;
        }

        throw new Error(`Unknown argument: ${argument}`);
    }

    return {
        json,
        options: {
            aztecEnv,
        },
    };
}

function parseIssueKycFlags(args: string[]): ParsedGuardianCliCommand<IssueKycCliOptions> {
    let json = false;
    let aztecEnv: string | undefined;
    let inputPath: string | undefined;

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--json") {
            json = true;
            continue;
        }

        if (argument === "--network") {
            aztecEnv = args[index + 1];
            if (!aztecEnv) {
                throw new Error("Missing value for --network");
            }

            index += 1;
            continue;
        }

        if (argument === "--input") {
            inputPath = args[index + 1];
            if (!inputPath) {
                throw new Error("Missing value for --input");
            }

            index += 1;
            continue;
        }

        throw new Error(`Unknown argument: ${argument}`);
    }

    return {
        json,
        options: {
            aztecEnv,
            inputPath,
        },
    };
}

function parseRevokeCertificateFlags(args: string[]): ParsedGuardianCliCommand<RevokeCertificateCliOptions> {
    let json = false;
    let aztecEnv: string | undefined;
    let revocationId: string | undefined;

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--json") {
            json = true;
            continue;
        }

        if (argument === "--network") {
            aztecEnv = args[index + 1];
            if (!aztecEnv) {
                throw new Error("Missing value for --network");
            }

            index += 1;
            continue;
        }

        if (argument === "--revocation-id") {
            revocationId = args[index + 1];
            if (!revocationId) {
                throw new Error("Missing value for --revocation-id");
            }

            index += 1;
            continue;
        }

        throw new Error(`Unknown argument: ${argument}`);
    }

    return {
        json,
        options: {
            aztecEnv,
            revocationId: revocationId ?? "",
        },
    };
}

const guardianCliCommands = {
    "account status": {
        key: "account status",
        usage: "guardian-aztec-connect account status [--network <name>] [--json]",
        parse: parseNetworkJsonFlags,
        execute: getGuardianAccountStatus,
        format: formatAccountResult,
        serialize: serializeAccountResult,
    } satisfies GuardianCliCommand<GuardianCliBaseOptions, GuardianAccountStatus>,
    "account deploy": {
        key: "account deploy",
        usage: "guardian-aztec-connect account deploy [--network <name>] [--json]",
        parse: parseNetworkJsonFlags,
        execute: deployGuardianAccountIfNeeded,
        format: formatAccountResult,
        serialize: serializeAccountResult,
    } satisfies GuardianCliCommand<GuardianCliBaseOptions, DeployGuardianAccountResult>,
    "kyc issue": {
        key: "kyc issue",
        usage: "guardian-aztec-connect kyc issue --input <file> [--network <name>] [--json]",
        parse: parseIssueKycFlags,
        async execute(options: IssueKycCliOptions) {
            if (!options.inputPath) {
                throw new Error("Missing value for --input");
            }

            return await issueKycCertificate({
                aztecEnv: options.aztecEnv,
                kyc: loadKycInputFromFile(options.inputPath),
            });
        },
        format: formatIssueKycResult,
        serialize: serializeIssueKycResult,
    } satisfies GuardianCliCommand<IssueKycCliOptions, IssueKycCertificateResult>,
    "kyc list-revokable": {
        key: "kyc list-revokable",
        usage: "guardian-aztec-connect kyc list-revokable [--network <name>] [--json]",
        parse: parseNetworkJsonFlags,
        execute: listRevokableCertificates,
        format: formatListRevokableCertificatesResult,
        serialize: serializeListRevokableCertificatesResult,
    } satisfies GuardianCliCommand<GuardianCliBaseOptions, ListRevokableCertificatesResult>,
    "kyc revoke": {
        key: "kyc revoke",
        usage: "guardian-aztec-connect kyc revoke --revocation-id <id> [--network <name>] [--json]",
        parse: parseRevokeCertificateFlags,
        async execute(options: RevokeCertificateCliOptions) {
            if (!options.revocationId) {
                throw new Error("Missing value for --revocation-id");
            }

            return await revokeCertificate({
                aztecEnv: options.aztecEnv,
                ephemeral: options.ephemeral,
                registerInitialAccounts: options.registerInitialAccounts,
                revocationId: options.revocationId,
            });
        },
        format: formatRevokeCertificateResult,
        serialize: serializeRevokeCertificateResult,
    } satisfies GuardianCliCommand<RevokeCertificateCliOptions, RevokeCertificateResult>,
} satisfies Record<string, GuardianCliCommand<object, GuardianCliCommandResult>>;

export function getGuardianCliCommand(commandKey: string): GuardianCliCommand | undefined {
    return guardianCliCommands[commandKey as keyof typeof guardianCliCommands];
}

export function listGuardianCliCommands(): GuardianCliCommand[] {
    return Object.values(guardianCliCommands);
}
