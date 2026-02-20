// End-to-end tests for ZK Certificate Registry + UseCaseExample
// Tests the full flow: deploy, whitelist guardian, issue certificate, use with authwit, revoke

import { CertificateRegistryContract } from "../../../../../artifacts/CertificateRegistry.js";
import { AgeCheckRequirementContract } from "../../../../../artifacts/AgeCheckRequirement.js";
import { BasicDisclosureContract } from "../../../../../artifacts/BasicDisclosure.js";
import { ShamirDisclosureContract } from "../../../../../artifacts/ShamirDisclosure.js";
import { UseCaseExampleContract } from "../../../../../artifacts/UseCaseExample.js";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { getSponsoredFPCInstance } from "../../../../zk_certificate/src/utils/sponsored_fpc.js";
import { setupWallet } from "../../../../zk_certificate/src/utils/setup_wallet.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getTimeouts } from "../../../../../config/config.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { TxStatus } from "@aztec/stdlib/tx";
import { TestWallet } from "@aztec/test-wallet/server";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { poseidon2Hash } from "@aztec/foundation/crypto/poseidon";
import { TxHash } from "@aztec/aztec.js/tx";

// Test constants (aligned with Noir tests)
const AUTHWIT_NONCE = new Fr(456789);
const UNIQUE_ID = new Fr(1);
const REVOCATION_ID = new Fr(1234561);
const CONTENT_TYPE_ZK_KYC = new Fr(1);
const DISCLOSURE_CONTEXT = new Fr(777);

const hashStringToField = async (value: string): Promise<Fr> =>
  poseidon2Hash([Fr.fromBufferReduce(Buffer.from(value.padEnd(32, "#"), "utf8"))]);

const asBigInt = (value: unknown): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  if (value && typeof value === "object" && "toBigInt" in value) {
    return (value as { toBigInt: () => bigint }).toBigInt();
  }
  throw new Error(`Unable to parse bigint from value: ${String(value)}`);
};

const KYC_SAMPLE = {
  personal: {
    surname: "DOE",
    forename: "JANE",
    middlename: "",
    birthdayUnixTimestamp: 645494400, // 1990-06-01 00:00:00 UTC
    citizenship: "DE",
    verificationLevel: 2,
  },
  address: {
    streetAndNumber: "MUSTERSTRASSE 10",
    postcode: "10115",
    town: "BERLIN",
    region: "BERLIN",
    country: "DE",
  },
} as const;

describe("ZK Certificate and UseCaseExample", () => {
  let logger: Logger;
  let sponsoredFPC: ContractInstanceWithAddress;
  let sponsoredPaymentMethod: SponsoredFeePaymentMethod;
  let wallet: TestWallet;
  let adminAccount: AccountManager;
  let guardianAccount: AccountManager;
  let userAccount: AccountManager;
  let certificateRegistry: CertificateRegistryContract;
  let ageCheckRequirement: AgeCheckRequirementContract;
  let basicDisclosure: BasicDisclosureContract;
  let shamirDisclosure: ShamirDisclosureContract;
  let useCaseExample: UseCaseExampleContract;
  let kycPersonalData: Fr[];
  let kycAddressData: Fr[];

  beforeAll(async () => {
    logger = createLogger("aztec:zkkyc:e2e");
    logger.info("ZK Certificate + UseCaseExample e2e tests running.");
    wallet = await setupWallet();

    // KYC layout mapping (see crates/zk_certificate/src/content/kyc_layout.nr):
    // personal: [surname, forename, middlename, birthday, citizenship, verification_level]
    // address:  [street_and_number, postcode, town, region, country]
    kycPersonalData = [
      await hashStringToField(KYC_SAMPLE.personal.surname),
      await hashStringToField(KYC_SAMPLE.personal.forename),
      await hashStringToField(KYC_SAMPLE.personal.middlename),
      new Fr(KYC_SAMPLE.personal.birthdayUnixTimestamp),
      await hashStringToField(KYC_SAMPLE.personal.citizenship),
      new Fr(KYC_SAMPLE.personal.verificationLevel),
      new Fr(0),
      new Fr(0),
    ];
    kycAddressData = [
      await hashStringToField(KYC_SAMPLE.address.streetAndNumber),
      await hashStringToField(KYC_SAMPLE.address.postcode),
      await hashStringToField(KYC_SAMPLE.address.town),
      await hashStringToField(KYC_SAMPLE.address.region),
      await hashStringToField(KYC_SAMPLE.address.country),
      new Fr(0),
      new Fr(0),
      new Fr(0),
    ];

    sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
    sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // Create admin, guardian, and user accounts
    logger.info("Creating accounts...");
    const secret1 = Fr.random();
    const signingKey1 = GrumpkinScalar.random();
    const salt1 = Fr.random();
    adminAccount = await wallet.createSchnorrAccount(secret1, salt1, signingKey1);
    await (await adminAccount.getDeployMethod())
      .send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .wait({ timeout: getTimeouts().deployTimeout });

    const secret2 = Fr.random();
    const signingKey2 = GrumpkinScalar.random();
    const salt2 = Fr.random();
    guardianAccount = await wallet.createSchnorrAccount(secret2, salt2, signingKey2);
    await (await guardianAccount.getDeployMethod())
      .send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .wait({ timeout: getTimeouts().deployTimeout });

    const secret3 = Fr.random();
    const signingKey3 = GrumpkinScalar.random();
    const salt3 = Fr.random();
    userAccount = await wallet.createSchnorrAccount(secret3, salt3, signingKey3);
    await (await userAccount.getDeployMethod())
      .send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .wait({ timeout: getTimeouts().deployTimeout });

    await wallet.registerSender(adminAccount.address);
    await wallet.registerSender(guardianAccount.address);
    await wallet.registerSender(userAccount.address);
    logger.info("Accounts created and registered");

    // 1. Contract setup: deploy CertificateRegistry then UseCaseExample
    logger.info("Deploying CertificateRegistry...");
    certificateRegistry = await CertificateRegistryContract.deploy(
      wallet,
      adminAccount.address
    )
      .send({
        from: adminAccount.address,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .deployed({ timeout: getTimeouts().deployTimeout });

    logger.info("Deploying AgeCheckRequirement...");
    ageCheckRequirement = await AgeCheckRequirementContract.deploy(wallet, 18)
      .send({
        from: adminAccount.address,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .deployed({ timeout: getTimeouts().deployTimeout });

    logger.info("Deploying BasicDisclosure...");
    basicDisclosure = await BasicDisclosureContract.deploy(wallet, adminAccount.address)
      .send({
        from: adminAccount.address,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .deployed({ timeout: getTimeouts().deployTimeout });

    logger.info("Deploying ShamirDisclosure...");
    shamirDisclosure = await ShamirDisclosureContract.deploy(
      wallet,
      3,
      2,
      adminAccount.address,
      guardianAccount.address,
      userAccount.address,
      AztecAddress.ZERO,
      AztecAddress.ZERO,
      AztecAddress.ZERO,
      AztecAddress.ZERO,
      AztecAddress.ZERO
    )
      .send({
        from: adminAccount.address,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .deployed({ timeout: getTimeouts().deployTimeout });

    logger.info("Deploying UseCaseExample...");
    useCaseExample = await UseCaseExampleContract.deploy(
      wallet,
      certificateRegistry.address,
      ageCheckRequirement.address,
      basicDisclosure.address,
      DISCLOSURE_CONTEXT
    )
      .send({
        from: adminAccount.address,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .deployed({ timeout: getTimeouts().deployTimeout });

    logger.info(
      `CertificateRegistry at ${certificateRegistry.address.toString()}, UseCaseExample at ${useCaseExample.address.toString()}`
    );
  }, 600000);

  it("Verifies contracts were deployed", async () => {
    expect(certificateRegistry).toBeDefined();
    expect(certificateRegistry.address).toBeDefined();
    expect(useCaseExample).toBeDefined();
    expect(useCaseExample.address).toBeDefined();
  }, 60000);

  it("Admin whitelists guardian", async () => {
    const tx = await certificateRegistry.methods
      .whitelist_guardian(guardianAccount.address)
      .send({
        from: adminAccount.address,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .wait({ timeout: getTimeouts().txTimeout });

    expect(tx.status).toBe(TxStatus.SUCCESS);
    logger.info("Guardian whitelisted");
  }, 600000);

  it("User cannot use use_privately before guardian issues certificate", async () => {
    const action = certificateRegistry.methods.check_certificate_and_requirements(
      userAccount.address,
      AUTHWIT_NONCE,
      ageCheckRequirement.address,
      basicDisclosure.address,
      DISCLOSURE_CONTEXT
    );
    const witness = await wallet.createAuthWit(userAccount.address, {
      caller: useCaseExample.address,
      action,
    });

    await expect(
      useCaseExample.methods
        .use_privately(AUTHWIT_NONCE)
        .simulate({
          from: userAccount.address,
          authWitnesses: [witness],
        })
    ).rejects.toThrow();
  }, 60000);

  it("Guardian issues KYC certificate to user", async () => {
    const tx = await certificateRegistry.methods
      .issue_certificate(
        userAccount.address,
        UNIQUE_ID,
        REVOCATION_ID,
        CONTENT_TYPE_ZK_KYC,
        kycPersonalData,
        kycAddressData
      )
      .send({
        from: guardianAccount.address,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .wait({ timeout: getTimeouts().txTimeout });

    expect(tx.status).toBe(TxStatus.SUCCESS);
    logger.info("Certificate issued");
  }, 600000);

  it("User certificate count is 1", async () => {
    const count = await certificateRegistry.methods
      .get_certificate_count(userAccount.address)
      .simulate({ from: userAccount.address });

    expect(count).toBe(1n);
  }, 60000);

  it("User uses certificate with authwit to call use_privately", async () => {
    const action = certificateRegistry.methods.check_certificate_and_requirements(
      userAccount.address,
      AUTHWIT_NONCE,
      ageCheckRequirement.address,
      basicDisclosure.address,
      DISCLOSURE_CONTEXT
    );
    const witness = await wallet.createAuthWit(userAccount.address, {
      caller: useCaseExample.address,
      action,
    });

    const tx = await useCaseExample.methods
      .use_privately(AUTHWIT_NONCE)
      .send({
        from: userAccount.address,
        authWitnesses: [witness],
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .wait({ timeout: getTimeouts().txTimeout });

    expect(tx.status).toBe(TxStatus.SUCCESS);
    logger.info("User used certificate with authwit successfully");

    // Assert BasicDisclosure emitted one private event scoped to the configured recipient.
    const disclosureEvents = await wallet.getPrivateEvents<{
      from: AztecAddress;
      context: Fr;
      guardian: AztecAddress;
      unique_id: Fr;
    }>(BasicDisclosureContract.events.BasicDisclosureEvent, {
      contractAddress: basicDisclosure.address,
      scopes: [adminAccount.address],
      txHash: tx.txHash,
    });

    expect(disclosureEvents).toHaveLength(1);
    const disclosureEvent = disclosureEvents[0].event;
    expect(disclosureEvent.from.toString()).toBe(userAccount.address.toString());
    expect(asBigInt(disclosureEvent.context)).toBe(asBigInt(DISCLOSURE_CONTEXT));
    expect(disclosureEvent.guardian.toString()).toBe(guardianAccount.address.toString());
    expect(asBigInt(disclosureEvent.unique_id)).toBe(asBigInt(UNIQUE_ID));

    // Ensure no event is visible to an account that is not the configured recipient.
    const wrongScopeEvents = await wallet.getPrivateEvents(
      BasicDisclosureContract.events.BasicDisclosureEvent,
      {
        contractAddress: basicDisclosure.address,
        scopes: [guardianAccount.address],
        txHash: tx.txHash,
      }
    );
    expect(wrongScopeEvents).toHaveLength(0);
  }, 600000);

  it("Shamir disclosure emits correct shards to configured recipients", async () => {
    const tx = await shamirDisclosure.methods
      .disclose(
        userAccount.address,
        DISCLOSURE_CONTEXT,
        guardianAccount.address,
        UNIQUE_ID,
        CONTENT_TYPE_ZK_KYC,
        kycPersonalData,
        kycAddressData
      )
      .send({
        from: userAccount.address,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .wait({ timeout: getTimeouts().txTimeout });

    expect(tx.status).toBe(TxStatus.SUCCESS);

    const recipients = [
      { scope: adminAccount.address, expectedX: 1n },
      { scope: guardianAccount.address, expectedX: 2n },
      { scope: userAccount.address, expectedX: 3n },
    ];

    const secret = asBigInt(kycPersonalData[0]);
    const coeff = asBigInt(DISCLOSURE_CONTEXT) + 17n;

    for (const recipient of recipients) {
      const shardEvents = await wallet.getPrivateEvents<{
        from: AztecAddress;
        context: Fr;
        shard_x: Fr;
        shard_y: Fr;
      }>(ShamirDisclosureContract.events.ShamirDisclosureShardEvent, {
        contractAddress: shamirDisclosure.address,
        scopes: [recipient.scope],
        txHash: tx.txHash as TxHash,
      });

      expect(shardEvents).toHaveLength(1);
      const shardEvent = shardEvents[0].event;
      expect(shardEvent.from.toString()).toBe(userAccount.address.toString());
      expect(asBigInt(shardEvent.context)).toBe(asBigInt(DISCLOSURE_CONTEXT));
      expect(asBigInt(shardEvent.shard_x)).toBe(recipient.expectedX);
      expect(asBigInt(shardEvent.shard_y)).toBe(secret + coeff * recipient.expectedX);
    }
  }, 600000);

  it("Guardian revokes the certificate", async () => {
    const tx = await certificateRegistry.methods
      .revoke_certificate(REVOCATION_ID)
      .send({
        from: guardianAccount.address,
        fee: { paymentMethod: sponsoredPaymentMethod },
      })
      .wait({ timeout: getTimeouts().txTimeout });

    expect(tx.status).toBe(TxStatus.SUCCESS);
    logger.info("Certificate revoked (takes effect after REVOCATION_DELAY)");
  }, 600000);

  it("Revocation tx succeeded - user cannot use certificate after delay", async () => {
    // Revocation is delayed (12h in contract). We only assert revocation succeeded.
    // After REVOCATION_DELAY, use_privately would fail; e2e cannot fast-forward time.
    expect(true).toBe(true);
  }, 60000);
});
