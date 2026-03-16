import { InMemoryProcessingRepository } from "../../src/storage/inMemoryProcessingRepository.js";
import { createProcessingRecord } from "../../src/domain/processingRecord.js";

describe("InMemoryProcessingRepository", () => {
    let repo: InMemoryProcessingRepository;

    beforeEach(() => {
        repo = new InMemoryProcessingRepository();
    });

    it("saves and retrieves by id", async () => {
        const record = createProcessingRecord("id-1", "holder-1");
        await repo.save(record);
        const got = await repo.getById("id-1");
        expect(got).not.toBeNull();
        expect(got!.holderCommitment).toBe("holder-1");
        expect(got!.status).toBe("accessTokenIssued");
    });

    it("retrieves by applicantId after save with applicantId", async () => {
        const record = createProcessingRecord("id-2", "holder-2", { applicantId: "app-2" });
        await repo.save(record);
        const got = await repo.getByApplicantId("app-2");
        expect(got!.id).toBe("id-2");
    });

    it("retrieves by holderCommitment", async () => {
        const record = createProcessingRecord("id-3", "holder-3");
        await repo.save(record);
        const got = await repo.getByHolderCommitment("holder-3");
        expect(got!.id).toBe("id-3");
    });

    it("updateStatus updates record", async () => {
        const record = createProcessingRecord("id-4", "holder-4");
        await repo.save(record);
        await repo.updateStatus("id-4", "approved", { applicantId: "app-4" });
        const got = await repo.getById("id-4");
        expect(got!.status).toBe("approved");
        expect(got!.applicantId).toBe("app-4");
        const byApp = await repo.getByApplicantId("app-4");
        expect(byApp!.id).toBe("id-4");
    });

    it("getByApplicantId returns null when missing", async () => {
        const got = await repo.getByApplicantId("nonexistent");
        expect(got).toBeNull();
    });
});
