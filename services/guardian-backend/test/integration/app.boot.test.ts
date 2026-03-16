import { setRequiredEnv } from "../support/env.js";
import { createApp } from "../../src/http/app.js";
import { createHandlers } from "../../src/http/handlers.js";
import { stubKycService } from "../../src/domain/stubKycService.js";
import { loadConfig } from "../../src/config/env.js";

/**
 * Integration smoke test: app and config can be created without real Sumsub or Aztec.
 */
describe("app boot", () => {
    it("loads config when required env is set", () => {
        setRequiredEnv();
        const config = loadConfig();
        expect(config.sumsub.appToken).toBeDefined();
        expect(config.port).toBeGreaterThan(0);
    });

    it("createApp with stub handlers responds to access-token route", async () => {
        const app = createApp(createHandlers(stubKycService));
        const { createServer } = await import("node:http");
        await new Promise<void>((resolve, reject) => {
            const server = createServer(app);
            server.listen(0, () => {
                const address = server.address();
                if (!address || typeof address === "string") {
                    server.close();
                    return reject(new Error("No port"));
                }
                const url = `http://localhost:${address.port}/api/v1/access-token`;
                fetch(url, {
                    method: "POST",
                    body: JSON.stringify({ holderCommitment: "test-holder" }),
                    headers: { "Content-Type": "application/json" },
                })
                    .then((r) => {
                        expect(r.status).toBe(200);
                        server.close();
                        resolve();
                    })
                    .catch(reject);
            });
        });
    });
});
