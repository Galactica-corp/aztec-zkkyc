/**
 * Updates the demo app sandbox deployment config with Certificate Registry and
 * Use Case Example contract addresses by writing a payload and invoking
 * apps/demo/scripts/update-sandbox-deployment.ts.
 */

import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DEMO = path.join(__dirname, "../../apps/demo");
const DEPLOY_OUTPUT_JSON = path.join(APPS_DEMO, ".deploy-output.json");

export interface UpdateDemoSandboxParams {
  certificateRegistryContract: { address: string; salt: string };
  useCaseExampleContract: { address: string; salt: string };
  /** Admin address used in Certificate Registry constructor (from getCertificateRegistryAdminAddress) */
  certificateRegistryAdminAddress: string;
  deployer: string;
  nodeUrl?: string;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
}

/**
 * Writes deployment payload to apps/demo and runs the demo's update-sandbox-deployment script.
 * Returns true if the update succeeded, false otherwise.
 */
export function updateDemoSandboxDeployment(
  params: UpdateDemoSandboxParams
): boolean {
  const { logger } = params;
  try {
    const payload = {
      certificateRegistryContract: params.certificateRegistryContract,
      useCaseExampleContract: params.useCaseExampleContract,
      certificateRegistryAdminAddress: params.certificateRegistryAdminAddress,
      deployer: params.deployer,
      nodeUrl: params.nodeUrl ?? "http://localhost:8080",
    };
    writeFileSync(DEPLOY_OUTPUT_JSON, JSON.stringify(payload, null, 2));
    const result = spawnSync(
      "npx",
      ["tsx", "scripts/update-sandbox-deployment.ts", DEPLOY_OUTPUT_JSON],
      { cwd: APPS_DEMO, stdio: "inherit", shell: true }
    );
    if (result.status !== 0) {
      logger?.warn(
        "Demo update-sandbox-deployment script exited with non-zero status"
      );
      return false;
    }
    logger?.info(
      "📝 Updated demo app sandbox deployment via apps/demo/scripts/update-sandbox-deployment.ts"
    );
    return true;
  } catch (err) {
    logger?.warn(
      `Could not update demo deployment: ${(err as Error).message}`
    );
    return false;
  }
}
