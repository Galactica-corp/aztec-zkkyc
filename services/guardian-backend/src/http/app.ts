import type { IncomingMessage, ServerResponse } from "node:http";

export type RequestHandler = (
    req: IncomingMessage,
    res: ServerResponse
) => void | Promise<void>;

/**
 * Builds the HTTP app: registers the three API routes and returns a request listener.
 * Does not start the server; used by server.ts and tests.
 */
export function createApp(handlers: {
    generateAccessToken: RequestHandler;
    attachEncryptionPublicKey: RequestHandler;
    handleWebhook: RequestHandler;
}): (req: IncomingMessage, res: ServerResponse) => void {
    return (req: IncomingMessage, res: ServerResponse) => {
        const method = req.method ?? "";
        const path = req.url?.split("?")[0] ?? "";

        if (method === "POST" && path === "/api/v1/access-token") {
            void handlers.generateAccessToken(req, res);
            return;
        }
        if (method === "PUT" && path.startsWith("/api/v1/applicants/") && path.endsWith("/encryption-public-key")) {
            void handlers.attachEncryptionPublicKey(req, res);
            return;
        }
        if (method === "POST" && path === "/api/v1/sumsub-webhook") {
            void handlers.handleWebhook(req, res);
            return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
    };
}
