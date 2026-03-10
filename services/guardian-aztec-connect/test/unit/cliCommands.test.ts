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
            deployed: true,
        };

        expect(serializeCliResult(result)).toMatchObject({
            address: "0xguardian",
            deployed: true,
        });
        expect(formatCliResult(result)).toContain("Deployment sent: yes");
        expect(formatCliResult(result)).toContain("Registered in wallet: yes");
    });
});
