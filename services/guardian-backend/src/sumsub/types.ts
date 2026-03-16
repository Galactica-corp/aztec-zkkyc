/**
 * Sumsub API and webhook types, aligned with the Go reference implementation.
 */

export interface Metadata {
    key: string;
    value: string;
}

export interface Address {
    country: string;
    stateCode?: string;
    townEn?: string;
    postCode?: string;
    streetEn?: string;
    buildingNumber?: string;
}

export interface ApplicantDataInfo {
    firstNameEn?: string;
    middleNameEn?: string;
    lastNameEn?: string;
    dob?: string;
    country?: string;
    addresses?: Address[];
}

export interface GetApplicantDataResponse {
    email?: string;
    info: ApplicantDataInfo;
    metadata: Metadata[];
}

export type ReviewAnswer = "GREEN" | "RED";

export interface ReviewResult {
    reviewAnswer: ReviewAnswer;
}

export interface ApplicantReviewed {
    applicantId: string;
    externalUserId: string;
    reviewResult: ReviewResult;
}

export interface GenerateAccessTokenResponse {
    token: string;
}

export interface ChangeProfileDataDetailsRequest {
    externalUserID?: string;
    email?: string;
    phone?: string;
    sourceKey?: string;
    lang?: string;
    metadata?: Metadata[];
}

export interface ErrorResponse {
    description: string;
    code: number;
    correlationId?: string;
    errorCode?: number;
    errorName?: string;
}
