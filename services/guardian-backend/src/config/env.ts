import "dotenv/config";

/**
 * Runtime configuration loaded from environment variables.
 * Validates required values at module load so the process fails fast when misconfigured.
 */
export interface Config {
    sumsub: {
        appToken: string;
        secretKey: string;
        webhookSecretKey: string;
    };
    port: number;
}

const required = [
    "SUMSUB_APP_TOKEN",
    "SUMSUB_SECRET_KEY",
    "SUMSUB_WEBHOOK_SECRET_KEY",
] as const;

/**
 * Load and validate configuration. Throws if any required variable is missing.
 */
export function loadConfig(): Config {
    const missing = required.filter((key) => !process.env[key]?.trim());
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}. Copy .env.example to .env and set values.`
        );
    }
    const port = process.env.PORT?.trim();
    return {
        sumsub: {
            appToken: process.env.SUMSUB_APP_TOKEN!,
            secretKey: process.env.SUMSUB_SECRET_KEY!,
            webhookSecretKey: process.env.SUMSUB_WEBHOOK_SECRET_KEY!,
        },
        port: port ? parseInt(port, 10) : 3005,
    };
}
