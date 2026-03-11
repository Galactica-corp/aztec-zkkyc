import fs from "fs";
import type { ZkKycInput } from "../types.js";

/**
 * Reads a normalized ZK-KYC payload from disk for the CLI `kyc issue` command.
 */
export function loadKycInputFromFile(inputPath: string): ZkKycInput {
    let rawJson: string;
    try {
        rawJson = fs.readFileSync(inputPath, "utf8");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Unable to read KYC input file "${inputPath}": ${message}`);
    }

    try {
        return JSON.parse(rawJson) as ZkKycInput;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`KYC input file "${inputPath}" must contain valid JSON: ${message}`);
    }
}
