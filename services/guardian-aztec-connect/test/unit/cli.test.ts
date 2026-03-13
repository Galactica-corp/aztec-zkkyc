import path from "path";
import { parseOptions } from "../../src/cli.js";
import { loadKycInputFromFile } from "../../src/cli/loadKycInput.js";

const exampleKycPath = path.resolve(process.cwd(), "examples/kyc.json");

describe("guardian CLI parsing", () => {
    it("parses the kyc issue command input path", () => {
        expect(parseOptions([
            "kyc",
            "issue",
            "--input",
            "./kyc.json",
            "--network",
            "devnet",
            "--json",
        ])).toEqual({
            commandKey: "kyc issue",
            json: true,
            options: {
                aztecEnv: "devnet",
                inputPath: "./kyc.json",
            },
        });
    });

    it("parses the kyc list-revokable command", () => {
        expect(parseOptions([
            "kyc",
            "list-revokable",
            "--network",
            "devnet",
            "--json",
        ])).toEqual({
            commandKey: "kyc list-revokable",
            json: true,
            options: {
                aztecEnv: "devnet",
            },
        });
    });

    it("parses the kyc revoke command", () => {
        expect(parseOptions([
            "kyc",
            "revoke",
            "--revocation-id",
            "222",
            "--network",
            "devnet",
            "--json",
        ])).toEqual({
            commandKey: "kyc revoke",
            json: true,
            options: {
                aztecEnv: "devnet",
                revocationId: "222",
            },
        });
    });

    it("fails when the input flag is missing its value", () => {
        expect(() => parseOptions(["kyc", "issue", "--input"])).toThrow("Missing value for --input");
    });

    it("fails when the revocation-id flag is missing its value", () => {
        expect(() => parseOptions(["kyc", "revoke", "--revocation-id"])).toThrow("Missing value for --revocation-id");
    });
});

describe("loadKycInputFromFile", () => {
    it("loads normalized kyc JSON from disk", () => {
        expect(loadKycInputFromFile(exampleKycPath)).toMatchObject({
            userAddress: "0x0f6b01f27e5a44fa7f14ac8761e2b5333c9307477326b3c27d6ab136b7edd722",
            personal: {
                citizenship: "DEU",
            },
            address: {
                region: "DE-BE",
                country: "DEU",
            },
        });
    });
});
