import * as http from "node:http";
import { createApp } from "../../src/http/app.js";
import { createHandlers } from "../../src/http/handlers.js";
import { stubKycService } from "../../src/domain/stubKycService.js";

function request(
    app: ReturnType<typeof createApp>,
    method: string,
    path: string,
    bodyOrOptions?: string | { body?: string; headers?: Record<string, string> }
): Promise<{ statusCode: number; body: string }> {
    const body = typeof bodyOrOptions === "string" ? bodyOrOptions : bodyOrOptions?.body;
    const extraHeaders = typeof bodyOrOptions === "object" && bodyOrOptions?.headers ? bodyOrOptions.headers : {};
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.listen(0, () => {
            const address = server.address();
            if (!address || typeof address === "string") {
                server.close();
                return reject(new Error("Could not get port"));
            }
            const port = address.port;
            const headers = body
                ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), ...extraHeaders }
                : extraHeaders;
            const req = http.request(
                {
                    host: "localhost",
                    port,
                    path,
                    method,
                    headers,
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

describe("createApp", () => {
    const app = createApp(createHandlers(stubKycService));

    it("mounts POST /api/v1/access-token", async () => {
        const res = await request(app, "POST", "/api/v1/access-token", JSON.stringify({ userAddress: "x" }));
        expect(res.statusCode).toBe(200);
    });

    it("mounts POST /api/v1/sumsub-webhook", async () => {
        const res = await request(app, "POST", "/api/v1/sumsub-webhook", {
            headers: {
                "X-Payload-Digest": "ab",
                "X-Payload-Digest-Alg": "HMAC_SHA256_HEX",
            },
        });
        expect(res.statusCode).toBe(200);
    });

    it("returns 404 for unknown path", async () => {
        const res = await request(app, "GET", "/api/v1/unknown");
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toBe("Not Found");
    });
});
