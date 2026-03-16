/**
 * Updates the demo app sandbox deployment config with Certificate Registry,
 * Age Check Requirement, and Use Case Example contract addresses by writing a payload and invoking
 * apps/demo/scripts/update-sandbox-deployment.ts.
 */

import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { updateGuardianAztecConnectEnv } from "./update-guardian-aztec-connect-env.js";
type DeploymentNetwork = "sandbox" | "devnet";

export interface DeploymentPayload {
    network?: DeploymentNetwork;
    certificateRegistryContract: { address: string; salt: string };
    ageCheckRequirementContract: { address: string; salt: string };
    sanctionListRequirementContract: { address: string; salt: string };
    basicDisclosureContract: { address: string; salt: string };
    shamirDisclosureContract: { address: string; salt: string };
    shamirDisclosureConstructorArgs: {
        recipientCount: number;
        threshold: number;
        recipients: [string, string, string];
        participantAddresses: [string, string, string, string, string];
    };
    useCaseExampleContract: { address: string; salt: string };
    certificateRegistryAdminAddress: string;
    deployer: string;
    nodeUrl?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DEMO = path.join(__dirname, "../../apps/demo");
const DEPLOY_OUTPUT_JSON = path.join(APPS_DEMO, ".deploy-output.json");

export interface UpdateDemoSandboxParams extends DeploymentPayload {
    network?: DeploymentNetwork;
    logger?: { info: (msg: string) => void; warn: (msg: string) => void };
}

export interface UpdateDeploymentTargetsParams extends UpdateDemoSandboxParams {
    logger: { info: (msg: string) => void; warn: (msg: string) => void };
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
    const network: DeploymentNetwork = params.network ?? "sandbox";
    const payload: DeploymentPayload = {
        network,
        certificateRegistryContract: params.certificateRegistryContract,
        ageCheckRequirementContract: params.ageCheckRequirementContract,
        sanctionListRequirementContract: params.sanctionListRequirementContract,
        basicDisclosureContract: params.basicDisclosureContract,
        shamirDisclosureContract: params.shamirDisclosureContract,
        shamirDisclosureConstructorArgs: params.shamirDisclosureConstructorArgs,
        useCaseExampleContract: params.useCaseExampleContract,
        certificateRegistryAdminAddress: params.certificateRegistryAdminAddress,
        deployer: params.deployer,
        nodeUrl: params.nodeUrl ?? "http://localhost:8080",
    };
    writeFileSync(DEPLOY_OUTPUT_JSON, JSON.stringify(payload, null, 2));
    const result = spawnSync(
      "npx",
      ["tsx", "scripts/update-sandbox-deployment.ts", DEPLOY_OUTPUT_JSON, network],
      { cwd: APPS_DEMO, stdio: "inherit", shell: true }
    );
    if (result.status !== 0) {
      logger?.warn(
        "Demo update-sandbox-deployment script exited with non-zero status"
      );
      return false;
    }
    logger?.info(
      `📝 Updated demo app ${network} deployment via apps/demo/scripts/update-sandbox-deployment.ts`
    );
    return true;
  } catch (err) {
    logger?.warn(
      `Could not update demo deployment: ${(err as Error).message}`
    );
    return false;
  }
}

/**
 * General helper that updates both guardian-aztec-connect env variables and
 * the demo app sandbox/devnet deployment configuration in a single call.
 */
export async function updateDeploymentTargets(
    params: UpdateDeploymentTargetsParams
): Promise<boolean> {
    const {
        certificateRegistryContract,
        certificateRegistryAdminAddress,
        deployer,
        logger,
    } = params;

    await updateGuardianAztecConnectEnv(
        certificateRegistryContract.address,
        certificateRegistryContract.salt,
        certificateRegistryAdminAddress,
        deployer,
        logger
    );

    return updateDemoSandboxDeployment(params);
}

