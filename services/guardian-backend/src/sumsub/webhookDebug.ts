import type { ApplicantDataInfo, GetApplicantDataResponse } from "./types.js";

function pickInfoForLog(info: ApplicantDataInfo | undefined) {
    if (!info) return undefined;
    return {
        firstNameEn: info.firstNameEn,
        middleNameEn: info.middleNameEn,
        lastNameEn: info.lastNameEn,
        dob: info.dob,
        country: info.country,
        address: info.address,
        addresses: info.addresses,
    };
}

/**
 * Logs the verified webhook JSON body (event envelope from Sumsub).
 * Does not include applicant profile fields — those arrive on the follow-up GET applicant call.
 */
export function logWebhookPayloadSummary(payload: unknown): void {
    try {
        console.log("[webhook] Incoming payload (verified JSON):\n%s", JSON.stringify(payload, null, 2));
    } catch {
        console.log("[webhook] Incoming payload could not be serialized for logging");
    }
}

/**
 * Logs profile fields returned by GET /resources/applicants/{id}/one after a webhook triggers issuance.
 */
export function logApplicantDataForWebhook(applicant: GetApplicantDataResponse): void {
    const snapshot = {
        email: applicant.email,
        metadata: applicant.metadata,
        info: pickInfoForLog(applicant.info),
        fixedInfo: pickInfoForLog(applicant.fixedInfo),
    };
    console.log("[webhook] Applicant data from Sumsub API (GET .../applicants/.../one):\n%s", JSON.stringify(snapshot, null, 2));
}
