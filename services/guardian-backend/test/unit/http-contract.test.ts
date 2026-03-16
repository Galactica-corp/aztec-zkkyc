import * as http from "node:http";
import { setRequiredEnv } from "../support/env.js";
import { createApp } from "../../src/http/app.js";
import { createHandlers } from "../../src/http/handlers.js";
import { stubKycService } from "../../src/domain/stubKycService.js";

function request(
    app: ReturnType<typeof createApp>,
    method: string,
    path: string,
    options?: { body?: string; headers?: Record<string, string> }
): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.listen(0, () => {
            const address = server.address();
            if (!address || typeof address === "string") {
                server.close();
                return reject(new Error("Could not get port"));
            }
            const { body, headers = {} } = options ?? {};
            const req = http.request(
                {
                    host: "localhost",
                    port: address.port,
                    path,
                    method,
                    headers: body
                        ? { "Content-Type": "application/json", ...headers, "Content-Length": Buffer.byteLength(body) }
                        : headers,
                },
                (res) => {
                    const chunks: Buffer[] = [];
                    res.on("data", (chunk: Buffer) => chunks.push(chunk));
                    res.on("end", () => {
                        server.close();
                        resolve({
                            statusCode: res.statusCode ?? 0,
                            body: Buffer.concat(chunks).toString("utf8"),
                        });
                    });
                }
            );
            req.on("error", (err) => {
                server.close();
                reject(err);
            });
            if (body) req.write(body);
            req.end();
        });
    });
}

describe("HTTP contract", () => {
    beforeAll(() => setRequiredEnv());

    const handlers = createHandlers(stubKycService);
    const app = createApp(handlers);

    describe("POST /api/v1/access-token", () => {
        it("returns 200 and JSON-encoded string token for valid userAddress", async () => {
            const res = await request(app, "POST", "/api/v1/access-token", {
                body: JSON.stringify({ userAddress: "0x1234" }),
            });
            expect(res.statusCode).toBe(200);
            const parsed = JSON.parse(res.body);
            expect(typeof parsed).toBe("string");
            expect(parsed).toBe("stub-access-token");
        });

        it("returns 400 for invalid JSON", async () => {
            const res = await request(app, "POST", "/api/v1/access-token", { body: "not json" });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toMatch(/Invalid JSON|Missing/);
        });

        it("returns 400 when userAddress is missing", async () => {
            const res = await request(app, "POST", "/api/v1/access-token", {
                body: JSON.stringify({}),
            });
            expect(res.statusCode).toBe(400);
        });
    });

    describe("POST /api/v1/sumsub-webhook", () => {
        it("returns 400 when X-Payload-Digest is missing", async () => {
            const res = await request(app, "POST", "/api/v1/sumsub-webhook", {
                body: "{}",
                headers: { "X-Payload-Digest-Alg": "HMAC_SHA256_HEX" },
            });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toMatch(/Missing X-Payload-Digest/);
        });

        it("returns 400 when X-Payload-Digest-Alg is missing", async () => {
            const res = await request(app, "POST", "/api/v1/sumsub-webhook", {
                body: "{}",
                headers: { "X-Payload-Digest": "deadbeef" },
            });
            expect(res.statusCode).toBe(400);
        });

        it("returns 200 with stub service when valid headers and body are sent", async () => {
            const res = await request(app, "POST", "/api/v1/sumsub-webhook", {
                body: "{}",
                headers: {
                    "X-Payload-Digest": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                    "X-Payload-Digest-Alg": "HMAC_SHA256_HEX",
                },
            });
            expect(res.statusCode).toBe(200);
            expect(res.body).toBe("");
        });
    });
});
