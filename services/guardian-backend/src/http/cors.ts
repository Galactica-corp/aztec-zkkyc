import type { IncomingMessage, ServerResponse } from "node:http";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

export type CorsOptions = {
    /**
     * Allowed origins for CORS requests.
     *
     * - Use an explicit list for production, e.g. ["https://app.example.com"].
     * - Use "*" to allow any origin (not recommended with credentials).
     */
    allowedOrigins: string[];
};

const DEFAULT_ALLOWED_HEADERS = [
    "Content-Type",
    "X-Payload-Digest",
    "X-Payload-Digest-Alg",
] as const;

const DEFAULT_ALLOWED_METHODS = ["POST", "OPTIONS"] as const;

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    if (allowedOrigins.includes("*")) return true;
    return allowedOrigins.includes(origin);
}

export function withCors(handler: Handler, options: CorsOptions): Handler {
    return (req, res) => {
        const originHeader = req.headers.origin;
        const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

        if (origin && isOriginAllowed(origin, options.allowedOrigins)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Vary", "Origin");
            res.setHeader("Access-Control-Allow-Methods", DEFAULT_ALLOWED_METHODS.join(", "));
            res.setHeader("Access-Control-Allow-Headers", DEFAULT_ALLOWED_HEADERS.join(", "));
        }

        // Handle preflight requests.
        if ((req.method ?? "").toUpperCase() === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
        }

        handler(req, res);
    };
}

