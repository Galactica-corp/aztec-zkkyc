import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { KYCService } from "../domain/kycService.js";
import { createProcessingRecord } from "../domain/processingRecord.js";
import type { ProcessingRepository } from "../domain/processingRepository.js";

const UTF8 = "utf8";

function readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, message: string): void {
    sendJson(res, status, { error: message });
}

export interface CreateHandlersOptions {
    kycService: KYCService;
    processingRepository?: ProcessingRepository;
}

/**
 * Build handlers that delegate to KYCService. Request/response shapes match the Go reference and frontend.
 * When processingRepository is provided, POST access-token creates/updates a record with optional userAddress.
 */
export function createHandlers(options: CreateHandlersOptions | KYCService) {
    const kycService = "generateAccessToken" in options ? options : options.kycService;
    const repository = "kycService" in options ? options.processingRepository : undefined;

    return {
        async generateAccessToken(req: IncomingMessage, res: ServerResponse): Promise<void> {
            let body: { holderCommitment?: string; userAddress?: string };
            try {
                const raw = await readBody(req);
                body = JSON.parse(raw.toString(UTF8)) as { holderCommitment?: string; userAddress?: string };
            } catch {
                sendError(res, 400, "Invalid JSON");
                return;
            }
            const holderCommitment = typeof body.holderCommitment === "string" ? body.holderCommitment.trim() : "";
            if (!holderCommitment) {
                sendError(res, 400, "Missing or invalid holderCommitment");
                return;
            }
            if (repository) {
                const userAddress = typeof body.userAddress === "string" ? body.userAddress.trim() : undefined;
                const existing = await repository.getByHolderCommitment(holderCommitment);
                if (existing) {
                    if (userAddress) {
                        await repository.updateStatus(existing.id, existing.status, { userAddress });
                    }
                } else {
                    const record = createProcessingRecord(randomUUID(), holderCommitment, { userAddress });
                    await repository.save(record);
                }
            }
            try {
                const token = await kycService.generateAccessToken(holderCommitment);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(token));
            } catch (err) {
                const message = err instanceof Error ? err.message : "Internal error";
                sendError(res, 500, message);
            }
        },

        async attachEncryptionPublicKey(req: IncomingMessage, res: ServerResponse): Promise<void> {
            const match = req.url?.split("?")[0]?.match(/^\/api\/v1\/applicants\/([^/]+)\/encryption-public-key$/);
            const applicantId = match?.[1];
            if (!applicantId) {
                sendError(res, 404, "Not Found");
                return;
            }
            let body: { encryptionPublicKey?: string };
            try {
                const raw = await readBody(req);
                body = JSON.parse(raw.toString(UTF8)) as { encryptionPublicKey?: string };
            } catch {
                sendError(res, 400, "Invalid JSON");
                return;
            }
            const key = body.encryptionPublicKey;
            if (key === undefined || key === null) {
                sendError(res, 400, "Missing encryptionPublicKey");
                return;
            }
            try {
                const bytes =
                    typeof key === "string" && /^[A-Za-z0-9+/=]+$/.test(key)
                        ? Buffer.from(key, "base64")
                        : Buffer.from(key, UTF8);
                await kycService.attachEncryptionPublicKey(applicantId, bytes);
                sendJson(res, 200, { ok: true });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Internal error";
                sendError(res, 500, message);
            }
        },

        async handleWebhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
            const digestHeader = req.headers["x-payload-digest"];
            const digestAlg = req.headers["x-payload-digest-alg"];
            if (typeof digestHeader !== "string" || !digestHeader.trim()) {
                sendError(res, 400, "Missing X-Payload-Digest");
                return;
            }
            if (typeof digestAlg !== "string" || !digestAlg.trim()) {
                sendError(res, 400, "Missing X-Payload-Digest-Alg");
                return;
            }
            let expectedDigest: Uint8Array;
            try {
                const hex = digestHeader.trim().toLowerCase();
                if (!/^[0-9a-f]+$/.test(hex)) throw new Error("Invalid hex");
                expectedDigest = new Uint8Array(hex.length / 2);
                for (let i = 0; i < expectedDigest.length; i++) {
                    expectedDigest[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
                }
            } catch {
                sendError(res, 400, "Invalid X-Payload-Digest");
                return;
            }
            const body = await readBody(req);
            try {
                await kycService.handleWebhook(expectedDigest, digestAlg.trim(), new Uint8Array(body));
                res.writeHead(200);
                res.end();
            } catch (err) {
                const message = err instanceof Error ? err.message : "Internal error";
                sendError(res, 500, message);
            }
        },
    };
}
