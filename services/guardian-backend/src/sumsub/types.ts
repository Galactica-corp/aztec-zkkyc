/**
 * Sumsub API and webhook types, aligned with the Go reference implementation.
 */

export interface Metadata {
    key: string;
    value: string;
}

/**
 * Address fields as returned on Sumsub `addresses[]` entries and the singular `address` object.
 * PoA rows often fill `streetEn` / `townEn`; ID-only flows may use `street` / `town` or only `formattedAddress`.
 */
export interface ApplicantAddressBlock {
    country?: string;
    stateCode?: string;
    state?: string;
    stateEn?: string;
    townEn?: string;
    town?: string;
    postCode?: string;
    streetEn?: string;
    street?: string;
    buildingNumber?: string;
    formattedAddress?: string;
}

/** @deprecated Use ApplicantAddressBlock; kept as alias for callers that expect the old name. */
export type Address = ApplicantAddressBlock;

export interface ApplicantDataInfo {
    firstNameEn?: string;
    middleNameEn?: string;
    lastNameEn?: string;
    dob?: string;
    country?: string;
    /** From proof-of-address documents when configured. */
    addresses?: ApplicantAddressBlock[];
    /** Single address object (e.g. from ID or registry) when `addresses` is empty. */
    address?: ApplicantAddressBlock;
}

export interface GetApplicantDataResponse {
    email?: string;
    info: ApplicantDataInfo;
    /** User-submitted profile; same attribute shape as `info` per Sumsub docs. */
    fixedInfo?: ApplicantDataInfo;
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
