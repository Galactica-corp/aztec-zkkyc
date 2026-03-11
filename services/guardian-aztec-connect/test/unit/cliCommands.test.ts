import { getGuardianCliCommand, listGuardianCliCommands } from "../../src/cli/commands.js";
import { formatCliResult, serializeCliResult } from "../../src/cli/output.js";
import { createAddressStub, getLocalNetworkConfig } from "../support/fixtures.js";

describe("guardian CLI command registry", () => {
    it("registers the account commands", () => {
        const commands = listGuardianCliCommands();

        expect(commands.map((command) => command.key)).toEqual(["account status", "account deploy"]);
        expect(getGuardianCliCommand("account status")?.usage).toContain("account status");
        expect(getGuardianCliCommand("account deploy")?.usage).toContain("account deploy");
    });

    it("formats and serializes command results", () => {
        const result = {
            address: createAddressStub(),
            network: getLocalNetworkConfig(),
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
            network: getLocalNetworkConfig(),
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
});
