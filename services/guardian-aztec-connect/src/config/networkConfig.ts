import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import type { GuardianEnvironment, GuardianNetworkConfig } from "../types.js";

export interface ResolveNetworkConfigOptions {
    aztecEnv?: string;
}

interface NetworkConfigFile {
    name: string;
    environment: GuardianEnvironment;
    network: {
        nodeUrl: string;
        l1RpcUrl: string;
        l1ChainId: number;
    };
    timeouts?: {
        deployTimeout: number;
        txTimeout: number;
        waitTimeout: number;
    };
}

const DEFAULT_AZTEC_ENV = "local-network";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

function getDefaultTimeouts(environment: GuardianEnvironment) {
    if (environment === "devnet") {
        return {
            deployTimeout: 1200000,
            txTimeout: 180000,
            waitTimeout: 60000,
        };
    }

    return {
        deployTimeout: 120000,
        txTimeout: 60000,
        waitTimeout: 30000,
    };
}

function getSearchRoots(): string[] {
    const roots = new Set<string>();
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));

    roots.add(process.cwd());
    roots.add(moduleDir);

    return Array.from(roots);
}

function findConfigPath(aztecEnv: string): string | undefined {
    for (const searchRoot of getSearchRoots()) {
        let current = searchRoot;

        while (true) {
            const candidate = path.join(current, "config", `${aztecEnv}.json`);
            if (fs.existsSync(candidate)) {
                return candidate;
            }

            const parent = path.dirname(current);
            if (parent === current) {
                break;
            }

            current = parent;
        }
    }

    return undefined;
}

export function resolveNetworkConfig(options: ResolveNetworkConfigOptions = {}): GuardianNetworkConfig {
    const aztecEnv = options.aztecEnv ?? process.env.AZTEC_ENV ?? DEFAULT_AZTEC_ENV;
    const configPath = findConfigPath(aztecEnv);

    if (!configPath) {
        throw new Error(`Unable to load Aztec network config for "${aztecEnv}"`);
    }

    const rawConfig = fs.readFileSync(configPath, "utf8");
    const parsedConfig = JSON.parse(rawConfig) as NetworkConfigFile;
    const timeouts = parsedConfig.timeouts ?? getDefaultTimeouts(parsedConfig.environment);

    return {
        name: parsedConfig.name,
        environment: parsedConfig.environment,
        nodeUrl: parsedConfig.network.nodeUrl,
        l1RpcUrl: parsedConfig.network.l1RpcUrl,
        l1ChainId: parsedConfig.network.l1ChainId,
        txTimeoutMs: timeouts.txTimeout,
        deployTimeoutMs: timeouts.deployTimeout,
        waitTimeoutMs: timeouts.waitTimeout,
        configPath,
    };
}
