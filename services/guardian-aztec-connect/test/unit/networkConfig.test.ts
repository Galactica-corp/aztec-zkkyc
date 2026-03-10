import { resolveNetworkConfig } from "../../src/config/networkConfig.js";

function expectHttpUrl(value: string) {
    const parsedUrl = new URL(value);
    expect(["http:", "https:"]).toContain(parsedUrl.protocol);
    expect(parsedUrl.hostname).toBeTruthy();
}

describe("resolveNetworkConfig", () => {
    const originalEnv = process.env.AZTEC_ENV;

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.AZTEC_ENV;
            return;
        }

        process.env.AZTEC_ENV = originalEnv;
    });

    it("loads the local-network config by default", () => {
        delete process.env.AZTEC_ENV;

        const config = resolveNetworkConfig();

        expect(config.name).toBe("local-network");
        expect(config.environment).toBe("local");
        expectHttpUrl(config.nodeUrl);
        expectHttpUrl(config.l1RpcUrl);
        expect(Number.isInteger(config.l1ChainId)).toBe(true);
        expect(config.l1ChainId).toBeGreaterThan(0);
        expect(config.txTimeoutMs).toBeGreaterThan(0);
        expect(config.deployTimeoutMs).toBeGreaterThan(0);
        expect(config.waitTimeoutMs).toBeGreaterThan(0);
        expect(config.deployTimeoutMs).toBeGreaterThanOrEqual(config.txTimeoutMs);
        expect(config.configPath.endsWith("config/local-network.json")).toBe(true);
    });

    it("uses the explicit aztecEnv override", () => {
        process.env.AZTEC_ENV = "local-network";

        const config = resolveNetworkConfig({ aztecEnv: "devnet" });

        expect(config.name).toBe("devnet");
        expect(config.environment).toBe("devnet");
        expectHttpUrl(config.nodeUrl);
        expectHttpUrl(config.l1RpcUrl);
        expect(Number.isInteger(config.l1ChainId)).toBe(true);
        expect(config.l1ChainId).toBeGreaterThan(0);
        expect(config.txTimeoutMs).toBeGreaterThan(0);
        expect(config.deployTimeoutMs).toBeGreaterThan(0);
        expect(config.waitTimeoutMs).toBeGreaterThan(0);
        expect(config.deployTimeoutMs).toBeGreaterThanOrEqual(config.txTimeoutMs);
        expect(config.configPath.endsWith("config/devnet.json")).toBe(true);
    });

    it("throws a helpful error for an unknown config", () => {
        expect(() => resolveNetworkConfig({ aztecEnv: "missing-network" })).toThrow(
            "Unable to load Aztec network config for \"missing-network\""
        );
    });
});
