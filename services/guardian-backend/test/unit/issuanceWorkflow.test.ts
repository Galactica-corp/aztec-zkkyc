import { InMemoryProcessingRepository } from "../../src/storage/inMemoryProcessingRepository.js";
import { createIssuanceWorkflow } from "../../src/domain/issuanceWorkflow.js";
import { createProcessingRecord } from "../../src/domain/processingRecord.js";

describe("createIssuanceWorkflow", () => {
    let repo: InMemoryProcessingRepository;
    let workflow: ReturnType<typeof createIssuanceWorkflow>;

    beforeEach(() => {
        repo = new InMemoryProcessingRepository();
        workflow = createIssuanceWorkflow(repo);
    });

    it("creates a new record when no existing record", async () => {
        await workflow.processApprovedApplicant("app-1", "holder-1");
        const byApp = await repo.getByApplicantId("app-1");
        expect(byApp).not.toBeNull();
        expect(byApp!.status).toBe("approved");
        expect(byApp!.applicantId).toBe("app-1");
        expect(byApp!.sumsubExternalUserId).toBe("holder-1");
    });

    it("updates existing record by applicantId", async () => {
        const record = createProcessingRecord("id-2", "holder-2", { status: "applicantLoaded" });
        await repo.save(record);
        await workflow.processApprovedApplicant("app-2", "holder-2");
        const got = await repo.getById("id-2");
        expect(got!.status).toBe("approved");
        expect(got!.applicantId).toBe("app-2");
    });

    it("is idempotent when already issued", async () => {
        const record = createProcessingRecord("id-3", "holder-3", {
            status: "issued",
            applicantId: "app-3",
            issuanceResult: { uniqueId: 1n, revocationId: 2n, txHash: "0x" },
        });
        await repo.save(record);
        await workflow.processApprovedApplicant("app-3", "holder-3");
        const got = await repo.getById("id-3");
        expect(got!.status).toBe("issued");
    });

    it("finds by holderCommitment when applicantId not yet set", async () => {
        const record = createProcessingRecord("id-4", "holder-4");
        await repo.save(record);
        await workflow.processApprovedApplicant("app-4", "holder-4");
        const got = await repo.getById("id-4");
        expect(got!.status).toBe("approved");
        expect(got!.applicantId).toBe("app-4");
    });
});
