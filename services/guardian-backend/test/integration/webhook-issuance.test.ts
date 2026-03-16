import { setRequiredEnv } from "../support/env.js";
import { InMemoryProcessingRepository } from "../../src/storage/inMemoryProcessingRepository.js";
import { createProcessingRecord } from "../../src/domain/processingRecord.js";
import { createIssuanceWorkflow } from "../../src/domain/issuanceWorkflow.js";
import { createIssuanceRunner } from "../../src/domain/issuanceRunner.js";
import type { GetApplicantDataResponse } from "../../src/sumsub/types.js";

const minimalApplicant: GetApplicantDataResponse = {
    info: {
        firstNameEn: "Jane",
        lastNameEn: "Doe",
        dob: "1990-06-01",
        country: "DEU",
        addresses: [
            {
                country: "DEU",
                stateCode: "DE-BE",
                townEn: "Berlin",
                postCode: "10115",
                streetEn: "Musterstrasse",
                buildingNumber: "10",
            },
        ],
    },
    metadata: [],
};

describe("webhook to issuance", () => {
    beforeAll(() => setRequiredEnv());

    it("workflow creates record and runner persists issuance result when userAddress is set", async () => {
        const repository = new InMemoryProcessingRepository();
        const workflow = createIssuanceWorkflow(repository);
        let issueCalled = false;
        const runner = createIssuanceRunner({
            getApplicantData: async () => minimalApplicant,
            repository,
            runPreflight: async () => {},
            issue: async () => {
                issueCalled = true;
                return { uniqueId: 1n, revocationId: 2n, txHash: "0xtest" };
            },
        });

        const holderCommitment = "holder-1";
        const userAddress = "0x1234";
        const record = createProcessingRecord("id-1", holderCommitment, { userAddress });
        await repository.save(record);

        await workflow.processApprovedApplicant("app-1", holderCommitment);
        await runner.run("app-1");

        const after = await repository.getByApplicantId("app-1");
        expect(after?.status).toBe("issued");
        expect(after?.issuanceResult?.txHash).toBe("0xtest");
        expect(after?.issuanceResult?.uniqueId).toBe(1n);
        expect(issueCalled).toBe(true);
    });

    it("runner sets status to failed when userAddress is missing", async () => {
        const repository = new InMemoryProcessingRepository();
        const workflow = createIssuanceWorkflow(repository);
        const runner = createIssuanceRunner({
            getApplicantData: async () => minimalApplicant,
            repository,
        });

        const holderCommitment = "holder-2";
        const record = createProcessingRecord("id-2", holderCommitment);
        await repository.save(record);
        await workflow.processApprovedApplicant("app-2", holderCommitment);

        await runner.run("app-2");

        const after = await repository.getByApplicantId("app-2");
        expect(after?.status).toBe("failed");
        expect(after?.lastError).toMatch(/userAddress/);
    });

    it("runner is idempotent when already issued", async () => {
        const repository = new InMemoryProcessingRepository();
        const workflow = createIssuanceWorkflow(repository);
        let issueCount = 0;
        const runner = createIssuanceRunner({
            getApplicantData: async () => minimalApplicant,
            repository,
            issue: async () => {
                issueCount++;
                return { uniqueId: 3n, revocationId: 4n, txHash: "0x" };
            },
        });

        const record = createProcessingRecord("id-3", "holder-3", {
            userAddress: "0x",
            applicantId: "app-3",
            status: "issued",
            issuanceResult: { uniqueId: 1n, revocationId: 2n, txHash: "0xold" },
        });
        await repository.save(record);

        await runner.run("app-3");

        expect(issueCount).toBe(0);
        const after = await repository.getByApplicantId("app-3");
        expect(after?.issuanceResult?.txHash).toBe("0xold");
    });
});
