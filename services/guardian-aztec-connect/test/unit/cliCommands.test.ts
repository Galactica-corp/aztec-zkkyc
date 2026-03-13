import { getGuardianCliCommand, listGuardianCliCommands } from "../../src/cli/commands.js";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";
import { createAddressStub } from "../support/fixtures.js";

describe("guardian CLI command registry", () => {
    it("registers the account commands", () => {
        const commands = listGuardianCliCommands();

        expect(commands.map((command) => command.key)).toEqual([
            "account status",
            "account deploy",
            "kyc issue",
            "kyc list-revokable",
            "kyc revoke",
        ]);
        expect(getGuardianCliCommand("account status")?.usage).toContain("account status");
        expect(getGuardianCliCommand("account deploy")?.usage).toContain("account deploy");
        expect(getGuardianCliCommand("kyc issue")?.usage).toContain("kyc issue");
        expect(getGuardianCliCommand("kyc list-revokable")?.usage).toContain("kyc list-revokable");
        expect(getGuardianCliCommand("kyc revoke")?.usage).toContain("kyc revoke");
    });

    it("formats and serializes command results", () => {
        const command = getGuardianCliCommand("account deploy");
        const result = {
            address: createAddressStub(),
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
            isRegisteredInWallet: true,
            isContractInitialized: true,
            isWhitelisted: false,
            deployed: true,
        };

        expect(command?.serialize(result)).toMatchObject({
            address: "0xguardian",
            deployed: true,
            isWhitelisted: false,
        });
        expect(command?.format(result)).toContain("Deployment sent: yes");
        expect(command?.format(result)).toContain("Registered in wallet: yes");
        expect(command?.format(result)).toContain("Guardian whitelisted: no");
        expect(command?.format(result)).toContain("Contact the Galactica team to get this guardian whitelisted.");
    });

    it("reports whitelist lookup failures without failing formatting", () => {
        const command = getGuardianCliCommand("account status");
        const result = {
            address: createAddressStub(),
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
            isRegisteredInWallet: false,
            isContractInitialized: false,
            isWhitelisted: null,
            whitelistStatusError: "registry not reachable",
        };

        expect(command?.serialize(result)).toMatchObject({
            address: "0xguardian",
            isWhitelisted: null,
            whitelistStatusError: "registry not reachable",
        });
        expect(command?.format(result)).toContain("Guardian whitelisted: unavailable");
        expect(command?.format(result)).toContain("Whitelist status check failed: registry not reachable");
    });

    it("formats and serializes issuance results", () => {
        const command = getGuardianCliCommand("kyc issue");
        const result = {
            guardianAddress: createAddressStub("0xguardian"),
            userAddress: createAddressStub("0xuser"),
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
            uniqueId: 11n,
            revocationId: 22n,
            txHash: "0xtxhash",
        };

        expect(command?.serialize(result)).toMatchObject({
            guardianAddress: "0xguardian",
            userAddress: "0xuser",
            uniqueId: "11",
            revocationId: "22",
            txHash: "0xtxhash",
        });
        expect(command?.format(result)).toContain("Guardian address: 0xguardian");
        expect(command?.format(result)).toContain("User address: 0xuser");
        expect(command?.format(result)).toContain("Unique ID: 11");
        expect(command?.format(result)).toContain("Revocation ID: 22");
    });

    it("formats and serializes revokable certificate listing results", () => {
        const command = getGuardianCliCommand("kyc list-revokable");
        const result = {
            guardianAddress: createAddressStub("0xguardian"),
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
            count: 2,
            certificates: [
                {
                    uniqueId: 11n,
                    revocationId: 22n,
                    contentType: 1n,
                },
                {
                    uniqueId: 33n,
                    revocationId: 44n,
                    contentType: 1n,
                },
            ],
        };

        expect(command?.serialize(result)).toMatchObject({
            guardianAddress: "0xguardian",
            count: 2,
            certificates: [
                {
                    uniqueId: "11",
                    revocationId: "22",
                    contentType: "1",
                },
                {
                    uniqueId: "33",
                    revocationId: "44",
                    contentType: "1",
                },
            ],
        });
        expect(command?.format(result)).toContain("Guardian address: 0xguardian");
        expect(command?.format(result)).toContain("Revokable certificate count: 2");
        expect(command?.format(result)).toContain("[0] Unique ID: 11");
        expect(command?.format(result)).toContain("[1] Revocation ID: 44");
    });

    it("formats and serializes revocation results", () => {
        const command = getGuardianCliCommand("kyc revoke");
        const result = {
            guardianAddress: createAddressStub("0xguardian"),
            network: resolveNetworkConfig({ aztecEnv: "local-network" }),
            revocationId: 22n,
            txHash: "0xrevokehash",
        };

        expect(command?.serialize(result)).toMatchObject({
            guardianAddress: "0xguardian",
            revocationId: "22",
            txHash: "0xrevokehash",
        });
        expect(command?.format(result)).toContain("Guardian address: 0xguardian");
        expect(command?.format(result)).toContain("Revocation ID: 22");
        expect(command?.format(result)).toContain("Transaction hash: 0xrevokehash");
    });
});
