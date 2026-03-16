import { createServer } from "node:http";
import { loadConfig } from "./config/env.js";
import { createApp } from "./http/app.js";
import { createHandlers } from "./http/handlers.js";
import { createSumsubKycService } from "./sumsub/sumsubKycService.js";
import { SumsubClient } from "./sumsub/client.js";
import { InMemoryProcessingRepository } from "./storage/inMemoryProcessingRepository.js";
import { createIssuanceWorkflow } from "./domain/issuanceWorkflow.js";
import { createIssuanceRunner } from "./domain/issuanceRunner.js";

const config = loadConfig();
const repository = new InMemoryProcessingRepository();
const workflow = createIssuanceWorkflow(repository);
const sumsubClient = new SumsubClient({
    appToken: config.sumsub.appToken,
    secretKey: config.sumsub.secretKey,
});
const issuanceRunner = createIssuanceRunner({
    getApplicantData: (id) => sumsubClient.getApplicantData(id),
    repository,
});
const kycService = createSumsubKycService({
    appToken: config.sumsub.appToken,
    secretKey: config.sumsub.secretKey,
    webhookSecretKey: config.sumsub.webhookSecretKey,
    onApplicantReviewed: async (payload) => {
        await workflow.processApprovedApplicant(payload.applicantId, payload.externalUserId);
        await issuanceRunner.run(payload.applicantId);
    },
});
const handlers = createHandlers({ kycService, processingRepository: repository });
const app = createApp(handlers);
const server = createServer(app);

server.listen(config.port, () => {
    console.log(`Guardian backend listening on port ${config.port}`);
});
