import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { createGuardianAccount } from "../../src/wallet/guardianAccount.js";
import { getGuardianAccountStatus } from "../../src/wallet/accountStatus.js";
import { deployGuardianAccountIfNeeded } from "../../src/wallet/deployAccount.js";
import { createGuardianWallet } from "../../src/wallet/setupWallet.js";

describe("wallet setup integration", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env.AZTEC_ENV = "local-network";
        process.env.SECRET = Fr.random().toString();
        process.env.SALT = Fr.random().toString();
        process.env.SIGNING_KEY = GrumpkinScalar.random().toString();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it("loads the guardian account, reports status, and deploys it when needed", async () => {
        const wallet = await createGuardianWallet({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
        });
        const account = await createGuardianAccount(wallet);

        const initialStatus = await getGuardianAccountStatus({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
        });

        expect(initialStatus.address.toString()).toBe(account.address.toString());
        expect(typeof initialStatus.isContractInitialized).toBe("boolean");

        const deployedStatus = await deployGuardianAccountIfNeeded({
            aztecEnv: "local-network",
            ephemeral: true,
            registerInitialAccounts: false,
        });

        expect(deployedStatus.address.toString()).toBe(account.address.toString());
        expect(deployedStatus.isContractInitialized).toBe(true);
    });
});
