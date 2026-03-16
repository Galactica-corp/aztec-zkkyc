/**
 * Set required Sumsub env vars so loadConfig() can run in tests.
 * Call before importing or calling loadConfig().
 */
export function setRequiredEnv(): void {
    process.env.SUMSUB_APP_TOKEN = "test-app-token";
    process.env.SUMSUB_SECRET_KEY = "test-secret-key";
    process.env.SUMSUB_WEBHOOK_SECRET_KEY = "test-webhook-secret";
}

export function unsetRequiredEnv(): void {
    delete process.env.SUMSUB_APP_TOKEN;
    delete process.env.SUMSUB_SECRET_KEY;
    delete process.env.SUMSUB_WEBHOOK_SECRET_KEY;
}
