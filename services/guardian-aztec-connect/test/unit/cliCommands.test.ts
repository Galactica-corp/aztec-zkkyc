import { getGuardianCliCommand, listGuardianCliCommands } from "../../src/cli/commands.js";
import { formatCliResult, serializeCliResult } from "../../src/cli/output.js";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import { createAddressStub } from "../support/fixtures.js";

describe("guardian CLI command registry", () => {
    it("registers the account commands", () => {
        const commands = listGuardianCliCommands();

        expect(commands.map((command) => command.key)).toEqual(["account status", "account deploy", "kyc issue"]);
        expect(getGuardianCliCommand("account status")?.usage).toContain("account status");
        expect(getGuardianCliCommand("account deploy")?.usage).toContain("account deploy");
        expect(getGuardianCliCommand("kyc issue")?.usage).toContain("kyc issue");
    });

    it("formats and serializes command results", () => {
        const result = {
            address: createAddressStub(),
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
            isRegisteredInWallet: true,
            isContractInitialized: true,
            isWhitelisted: false,
            deployed: true,
        };

        expect(serializeCliResult(result)).toMatchObject({
            address: "0xguardian",
            deployed: true,
            isWhitelisted: false,
        });
        expect(formatCliResult(result)).toContain("Deployment sent: yes");
        expect(formatCliResult(result)).toContain("Registered in wallet: yes");
        expect(formatCliResult(result)).toContain("Guardian whitelisted: no");
        expect(formatCliResult(result)).toContain("Contact the Galactica team to get this guardian whitelisted.");
    });

    it("reports whitelist lookup failures without failing formatting", () => {
        const result = {
            address: createAddressStub(),
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
            isRegisteredInWallet: false,
            isContractInitialized: false,
            isWhitelisted: null,
            whitelistStatusError: "registry not reachable",
        };

        expect(serializeCliResult(result)).toMatchObject({
            address: "0xguardian",
            isWhitelisted: null,
            whitelistStatusError: "registry not reachable",
        });
        expect(formatCliResult(result)).toContain("Guardian whitelisted: unavailable");
        expect(formatCliResult(result)).toContain("Whitelist status check failed: registry not reachable");
    });

    it("formats and serializes issuance results", () => {
        const result = {
            guardianAddress: createAddressStub("0xguardian"),
            userAddress: createAddressStub("0xuser"),
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
            uniqueId: 11n,
            revocationId: 22n,
            txHash: "0xtxhash",
        };

        expect(serializeCliResult(result)).toMatchObject({
            guardianAddress: "0xguardian",
            userAddress: "0xuser",
            uniqueId: "11",
            revocationId: "22",
            txHash: "0xtxhash",
        });
        expect(formatCliResult(result)).toContain("Guardian address: 0xguardian");
        expect(formatCliResult(result)).toContain("User address: 0xuser");
        expect(formatCliResult(result)).toContain("Unique ID: 11");
        expect(formatCliResult(result)).toContain("Revocation ID: 22");
    });
});
