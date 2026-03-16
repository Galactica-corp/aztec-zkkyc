import countries from "i18n-iso-countries";
import type { GetApplicantDataResponse } from "../sumsub/types.js";
import type { NormalizedZkKyc } from "./normalizedZkKyc.js";

const ISO_ALPHA3 = /^[A-Za-z]{3}$/;
const BIRTHDAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Map Sumsub verification result to SDK verification level. Approved KYC => 2.
 */
export const SUMSUB_APPROVED_VERIFICATION_LEVEL = 2;

/**
 * Normalize country code to ISO 3166-1 alpha-3 uppercase. Pass-through if already 3 letters.
 */
function normalizeCountry(value: string | undefined, fieldName: string): string {
    const s = value?.trim();
    if (!s) throw new Error(`${fieldName} is required`);
    const up = s.toUpperCase();
    if (up.length === 3 && ISO_ALPHA3.test(up)) return up;
    if (up.length === 2) {
        const alpha3 = countries.alpha2ToAlpha3(up);
        if (alpha3 && ISO_ALPHA3.test(alpha3.toUpperCase())) return alpha3.toUpperCase();
    }
    throw new Error(`${fieldName} must be ISO 3166-1 alpha-2 or alpha-3`);
}

/**
 * Normalize birthday to YYYY-MM-DD. Sumsub may send "YYYY-MM-DD" or other formats.
 */
function normalizeBirthday(value: string | undefined, fieldName: string): string {
    const s = value?.trim();
    if (!s) throw new Error(`${fieldName} is required`);
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, y, m, d] = match;
        return `${y}-${m}-${d}`;
    }
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new Error(`${fieldName} must be a valid date`);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function requireNonEmpty(value: string | undefined, fieldName: string): string {
    const s = value?.trim();
    if (!s) throw new Error(`${fieldName} is required`);
    return s;
}

/**
 * Map Sumsub applicant data to normalized ZK-KYC input for guardian-aztec-connect.
 * userAddress must be provided by the caller (from processing record / frontend).
 */
export function normalizeSumsubToZkKyc(
    applicant: GetApplicantDataResponse,
    userAddress: string
): NormalizedZkKyc {
    const info = applicant.info ?? {};
    const addr = info.addresses?.[0];
    if (!addr) throw new Error("Applicant has no address");

    const birthday = normalizeBirthday(info.dob, "personal.birthday");
    if (!BIRTHDAY.test(birthday)) throw new Error("birthday must be YYYY-MM-DD");

    return {
        userAddress,
        personal: {
            surname: requireNonEmpty(info.lastNameEn, "personal.surname"),
            forename: requireNonEmpty(info.firstNameEn, "personal.forename"),
            middlename: info.middleNameEn?.trim() ?? "",
            birthday,
            citizenship: normalizeCountry(info.country ?? addr.country, "personal.citizenship"),
            verificationLevel: SUMSUB_APPROVED_VERIFICATION_LEVEL,
        },
        address: {
            streetAndNumber: requireNonEmpty(
                [addr.streetEn, addr.buildingNumber].filter(Boolean).join(" ").trim() || addr.streetEn,
                "address.streetAndNumber"
            ),
            postcode: requireNonEmpty(addr.postCode, "address.postcode"),
            town: requireNonEmpty(addr.townEn, "address.town"),
            region: addr.stateCode?.trim() ?? "",
            country: normalizeCountry(addr.country, "address.country"),
        },
    };
}
