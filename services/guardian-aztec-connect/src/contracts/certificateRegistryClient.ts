import type { ContractArtifact } from "@aztec/aztec.js/abi";
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";
import { Fr } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import * as dotenv from "dotenv";
import path from "path";
import { CertificateRegistryContract } from "../../../../artifacts/CertificateRegistry.js";
import type { PreparedKycCertificateIssuance } from "../kyc/zkKyc.js";
import { requireTransactionHash } from "../tx/guardianTx.js";
import { loadGuardianRuntime } from "../runtime/guardianRuntime.js";
import type {
  GuardianRegistryOptions,
  GuardianRuntime,
  GuardianRuntimeOptions,
  RevokableCertificateSummary,
} from "../types.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

export type CertificateRegistryContractInstance = CertificateRegistryContract;

export interface CertificateRegistryClient {
  address: AztecAddress;
  runtime: GuardianRuntime;
  contract: CertificateRegistryContractInstance;
}

export interface CertificateRegistryClientDependencies {
  loadArtifact(): Promise<ContractArtifact>;
  loadContract(
    address: AztecAddress,
    runtime: GuardianRuntime,
    artifact: ContractArtifact
  ): Promise<CertificateRegistryContractInstance>;
}

interface GuardianCertificatesPage {
  count: number | bigint;
  guardian: bigint;
  unique_id: bigint;
  revocation_id: bigint;
  content_type: bigint;
  has_more: boolean;
}

const defaultDependencies: CertificateRegistryClientDependencies = {
  async loadArtifact() {
    return CertificateRegistryContract.artifact;
  },
  async loadContract(address, runtime, artifact) {
    void artifact;
    return CertificateRegistryContract.at(address, runtime.wallet);
  },
};

export function resolveCertificateRegistryAddress(
  options: GuardianRegistryOptions = {},
  env: NodeJS.ProcessEnv = process.env
): AztecAddress {
  const configuredAddress = options.certificateRegistryAddress ?? env.CERTIFICATE_REGISTRY_ADDRESS;
  if (!configuredAddress) {
    throw new Error("CERTIFICATE_REGISTRY_ADDRESS environment variable is required");
  }

  return typeof configuredAddress === "string"
    ? AztecAddress.fromString(configuredAddress)
    : configuredAddress;
}

export async function createCertificateRegistryClientFromRuntime(
  runtime: GuardianRuntime,
  options: GuardianRegistryOptions = {},
  dependencies: CertificateRegistryClientDependencies = defaultDependencies
): Promise<CertificateRegistryClient> {
  const address = resolveCertificateRegistryAddress(options);
  const artifact = await dependencies.loadArtifact();
  await ensureCertificateRegistryContractRegistered(runtime, address, artifact, options);
  const contract = await dependencies.loadContract(address, runtime, artifact);

  return {
    address,
    runtime,
    contract,
  };
}

interface RuntimeWalletWithContractLookup {
  getContractMetadata(address: AztecAddress): Promise<{
    instance?: unknown;
  }>;
  registerContract(instance: unknown, artifact?: ContractArtifact): Promise<unknown>;
  pxe?: {
    getContractInstance(address: AztecAddress): Promise<unknown>;
  };
}

interface CertificateRegistryRegistration {
  adminAddress: AztecAddress;
  deployerAddress: AztecAddress;
  deploymentSalt: Fr;
}

export function resolveCertificateRegistryRegistration(
  options: GuardianRegistryOptions,
  runtime: GuardianRuntime,
  env: NodeJS.ProcessEnv = process.env
): CertificateRegistryRegistration | undefined {
  const adminAddress = options.certificateRegistryAdminAddress ?? env.CERTIFICATE_REGISTRY_ADMIN_ADDRESS;
  const deploymentSalt = options.certificateRegistryDeploymentSalt ?? env.CERTIFICATE_REGISTRY_DEPLOYMENT_SALT;
  if (!adminAddress || !deploymentSalt) {
    return undefined;
  }

  const deployerAddress = options.certificateRegistryDeployerAddress ??
    env.CERTIFICATE_REGISTRY_DEPLOYER_ADDRESS ??
    runtime.account.address;

  return {
    adminAddress: typeof adminAddress === "string" ? AztecAddress.fromString(adminAddress) : adminAddress,
    deployerAddress:
      typeof deployerAddress === "string" ? AztecAddress.fromString(deployerAddress) : deployerAddress,
    deploymentSalt: Fr.fromString(deploymentSalt),
  };
}

export async function ensureCertificateRegistryContractRegistered(
  runtime: GuardianRuntime,
  address: AztecAddress,
  artifact: ContractArtifact,
  options: GuardianRegistryOptions = {}
): Promise<void> {
  const wallet = runtime.wallet as unknown as RuntimeWalletWithContractLookup;

  const existingInstance = await wallet.pxe?.getContractInstance(address);
  if (existingInstance) {
    return;
  }

  const metadata = await wallet.getContractMetadata(address);
  if (!metadata.instance) {
    const registration = resolveCertificateRegistryRegistration(options, runtime);
    if (!registration) {
      throw new Error(
        `Certificate registry ${address.toString()} is not registered in PXE and no contract instance metadata is available. ` +
        "Set CERTIFICATE_REGISTRY_ADMIN_ADDRESS and CERTIFICATE_REGISTRY_DEPLOYMENT_SALT to reconstruct it."
      );
    }

    const instance = await getContractInstanceFromInstantiationParams(artifact, {
      salt: registration.deploymentSalt,
      deployer: registration.deployerAddress,
      constructorArgs: [registration.adminAddress],
      constructorArtifact: "constructor",
    });
    if (!instance.address.equals(address)) {
      throw new Error(
        `Certificate registry instantiation mismatch: expected ${address.toString()}, got ${instance.address.toString()}`
      );
    }

    await wallet.registerContract(instance, artifact);
    return;
  }

  await wallet.registerContract(metadata.instance, artifact);
}

export async function loadCertificateRegistryClient(
  options: GuardianRuntimeOptions & GuardianRegistryOptions = {},
  dependencies: CertificateRegistryClientDependencies = defaultDependencies
): Promise<CertificateRegistryClient> {
  const runtime = await loadGuardianRuntime(options);
  return await createCertificateRegistryClientFromRuntime(runtime, options, dependencies);
}

function toBigInt(value: bigint | Fr): bigint {
  return typeof value === "bigint" ? value : value.toBigInt();
}

export function isGuardianInWhitelist(
  guardianAddress: AztecAddress,
  guardianWhitelist: Array<bigint | Fr>
): boolean {
  const guardianAddressString = guardianAddress.toString();

  return guardianWhitelist.some((guardianField) => {
    const guardianFieldBigInt = toBigInt(guardianField);
    if (guardianFieldBigInt === 0n) {
      return false;
    }

    return AztecAddress.fromField(new Fr(guardianFieldBigInt)).toString() === guardianAddressString;
  });
}

export async function getGuardianWhitelistStatus(
  client: Pick<CertificateRegistryClient, "contract">,
  guardianAddress: AztecAddress
): Promise<boolean> {
  // Aztec `simulate()` returns a `SimulationResult` wrapper (`{ result, offchainEffects, ... }`),
  // so the raw whitelist array must be unwrapped before iterating.
  const guardianWhitelist = unwrapSimulationResult(
    await client.contract.methods.get_whitelisted_guardians().simulate({
      from: guardianAddress,
    })
  );

  return isGuardianInWhitelist(
    guardianAddress,
    guardianWhitelist as Array<bigint | Fr>
  );
}

function normalizePageCount(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

function unwrapSimulationResult<T>(value: T): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  if ("result" in candidate) {
    return candidate.result;
  }

  if ("value" in candidate) {
    return candidate.value;
  }

  if ("returnValue" in candidate) {
    return candidate.returnValue;
  }

  return value;
}

function normalizeSimulatedCount(value: unknown): number {
  const unwrapped = unwrapSimulationResult(value);
  if (typeof unwrapped === "bigint") {
    return Number(unwrapped);
  }
  if (typeof unwrapped === "number") {
    return unwrapped;
  }

  throw new Error("Unexpected certificate registry count simulation result");
}

function mapGuardianCertificateCopy(
  page: GuardianCertificatesPage
): RevokableCertificateSummary {
  return {
    uniqueId: page.unique_id,
    revocationId: page.revocation_id,
    contentType: page.content_type,
  };
}

/**
 * Lists all guardian-held certificate copies that can later be revoked by revocation ID.
 */
export async function listGuardianCertificateCopies(
  client: Pick<CertificateRegistryClient, "contract">,
  guardianAddress: AztecAddress
): Promise<{ count: number; certificates: RevokableCertificateSummary[] }> {
  const totalCount = normalizeSimulatedCount(
    await client.contract.methods.get_guardian_certificate_copies_count(guardianAddress).simulate({
      from: guardianAddress,
    })
  );
  if (totalCount === 0) {
    return {
      count: 0,
      certificates: [],
    };
  }

  const certificates: RevokableCertificateSummary[] = [];
  let pageIndex = 0;

  while (pageIndex < totalCount) {
    const page = unwrapSimulationResult(
      await client.contract.methods
        .get_guardian_certificate_copies(guardianAddress, pageIndex)
        .simulate({
          from: guardianAddress,
        })
    ) as GuardianCertificatesPage;
    if (normalizePageCount(page.count) === 0) {
      break;
    }

    certificates.push(mapGuardianCertificateCopy(page));

    if (!page.has_more) {
      break;
    }

    pageIndex += 1;
  }

  return {
    count: totalCount,
    certificates,
  };
}

/**
 * Submits the private `revoke_certificate` call through an already loaded certificate registry client.
 */
export async function revokeCertificateByRevocationId(
  client: Pick<CertificateRegistryClient, "contract">,
  revocationId: bigint | number | string,
  sendOptions: unknown
): Promise<{ txHash: string }> {
  const receipt = await client.contract.methods
    .revoke_certificate(Fr.fromString(revocationId.toString()))
    .send(sendOptions as never);

  return {
    txHash: requireTransactionHash(receipt as never, "Certificate revocation"),
  };
}

/**
 * Submits the private `issue_certificate` call through an already loaded certificate registry client.
 */
export async function issueCertificate(
  client: Pick<CertificateRegistryClient, "contract">,
  issuance: PreparedKycCertificateIssuance,
  sendOptions: unknown
): Promise<{ txHash: string }> {
  const receipt = await client.contract.methods
    .issue_certificate(
      issuance.userAddress,
      issuance.uniqueId,
      issuance.revocationId,
      issuance.contentType,
      issuance.personalData,
      issuance.addressData
    )
    .send(sendOptions as never);

  return {
    txHash: requireTransactionHash(receipt as never, "Certificate issuance"),
  };
}
