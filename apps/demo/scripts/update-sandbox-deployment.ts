/**
 * Updates apps/demo sandbox deployment config with Certificate Registry, Age Check Requirement,
 * and Use Case Example
 * contract addresses. Invoked from repo root after `yarn deploy` (scripts/deploy_contract.ts).
 *
 * Usage: tsx scripts/update-sandbox-deployment.ts <path-to-deployment-json>
 *
 * The JSON file must contain:
 *   certificateRegistryContract: { address: string, salt: string }
 *   ageCheckRequirementContract: { address: string, salt: string }
 *   basicDisclosureContract: { address: string, salt: string }
 *   shamirDisclosureContract: { address: string, salt: string }
 *   useCaseExampleContract: { address: string, salt: string }
 *   certificateRegistryAdminAddress: string
 *   deployer: string
 *   nodeUrl?: string
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SANDBOX_JSON_PATH = path.join(
  __dirname,
  "../src/config/deployments/sandbox.json"
);

export interface DeploymentPayload {
  certificateRegistryContract: { address: string; salt: string };
  ageCheckRequirementContract: { address: string; salt: string };
  basicDisclosureContract: { address: string; salt: string };
  shamirDisclosureContract: { address: string; salt: string };
  useCaseExampleContract: { address: string; salt: string };
  certificateRegistryAdminAddress: string;
  deployer: string;
  nodeUrl?: string;
}

function main(): void {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: tsx scripts/update-sandbox-deployment.ts <path-to-deployment-json>");
    process.exit(1);
  }

  let payload: DeploymentPayload;
  try {
    const raw = readFileSync(path.resolve(inputPath), "utf-8");
    payload = JSON.parse(raw) as DeploymentPayload;
  } catch (err) {
    console.error("Failed to read deployment payload:", (err as Error).message);
    process.exit(1);
  }

  const {
    certificateRegistryContract,
    ageCheckRequirementContract,
    basicDisclosureContract,
    shamirDisclosureContract,
    useCaseExampleContract,
    certificateRegistryAdminAddress,
    deployer,
    nodeUrl,
  } = payload;
  if (!certificateRegistryContract?.address || !certificateRegistryContract?.salt) {
    console.error("Payload must include certificateRegistryContract.address and .salt");
    process.exit(1);
  }
  if (!useCaseExampleContract?.address || !useCaseExampleContract?.salt) {
    console.error("Payload must include useCaseExampleContract.address and .salt");
    process.exit(1);
  }
  if (!ageCheckRequirementContract?.address || !ageCheckRequirementContract?.salt) {
    console.error("Payload must include ageCheckRequirementContract.address and .salt");
    process.exit(1);
  }
  if (!basicDisclosureContract?.address || !basicDisclosureContract?.salt) {
    console.error("Payload must include basicDisclosureContract.address and .salt");
    process.exit(1);
  }
  if (!shamirDisclosureContract?.address || !shamirDisclosureContract?.salt) {
    console.error("Payload must include shamirDisclosureContract.address and .salt");
    process.exit(1);
  }
  if (!certificateRegistryAdminAddress) {
    console.error("Payload must include certificateRegistryAdminAddress");
    process.exit(1);
  }
  if (!deployer) {
    console.error("Payload must include deployer");
    process.exit(1);
  }

  let deployment: Record<string, unknown>;
  try {
    const existing = readFileSync(SANDBOX_JSON_PATH, "utf-8");
    deployment = JSON.parse(existing) as Record<string, unknown>;
  } catch {
    deployment = {
      network: "sandbox",
      nodeUrl: nodeUrl ?? "http://localhost:8080",
      dripperContract: { address: "0x00", salt: "0x00" },
      tokenContract: { address: "0x00", salt: "0x00" },
      deployer,
      proverEnabled: false,
      deployedAt: new Date().toISOString(),
    };
  }

  deployment.certificateRegistryContract = certificateRegistryContract;
  deployment.ageCheckRequirementContract = ageCheckRequirementContract;
  deployment.basicDisclosureContract = basicDisclosureContract;
  deployment.shamirDisclosureContract = shamirDisclosureContract;
  deployment.useCaseExampleContract = useCaseExampleContract;
  deployment.certificateRegistryAdminAddress = certificateRegistryAdminAddress;
  deployment.deployer = deployer;
  deployment.nodeUrl = deployment.nodeUrl ?? nodeUrl ?? "http://localhost:8080";
  deployment.deployedAt = new Date().toISOString();

  writeFileSync(SANDBOX_JSON_PATH, JSON.stringify(deployment, null, 2));
  console.log("Updated sandbox deployment:", SANDBOX_JSON_PATH);
}

main();
