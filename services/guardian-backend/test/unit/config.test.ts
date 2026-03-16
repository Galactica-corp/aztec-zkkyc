import { unsetRequiredEnv, setRequiredEnv } from "../support/env.js";

describe("loadConfig", () => {
    beforeEach(() => {
        unsetRequiredEnv();
    });

    it("throws when required Sumsub vars are missing", async () => {
        const { loadConfig } = await import("../../src/config/env.js");
        unsetRequiredEnv();
        expect(() => loadConfig()).toThrow(/Missing required environment variables/);
    });

    it("returns config when all required vars are set", async () => {
        setRequiredEnv();
        const { loadConfig } = await import("../../src/config/env.js");
        const config = loadConfig();
        expect(config.sumsub.appToken).toBe("test-app-token");
        expect(config.sumsub.secretKey).toBe("test-secret-key");
        expect(config.sumsub.webhookSecretKey).toBe("test-webhook-secret");
        expect(config.port).toBe(3005);
    });

    it("uses PORT when set", async () => {
        setRequiredEnv();
        process.env.PORT = "4000";
        const { loadConfig } = await import("../../src/config/env.js");
        const config = loadConfig();
        expect(config.port).toBe(4000);
    });
});
