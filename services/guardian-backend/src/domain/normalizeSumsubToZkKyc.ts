import countries from "i18n-iso-countries";
import type { ApplicantAddressBlock, ApplicantDataInfo, GetApplicantDataResponse } from "../sumsub/types.js";
import type { NormalizedZkKyc } from "./normalizedZkKyc.js";

const ISO_ALPHA3 = /^[A-Za-z]{3}$/;
const BIRTHDAY = /^\d{4}-\d{2}-\d{2}$/;

const TESTNET_TEMPLATE_ADDRESS: ApplicantAddressBlock = {
    country: "DEU",
    stateCode: "DE-BE",
    townEn: "BERLIN",
    postCode: "10115",
    streetEn: "MUSTERSTRASSE",
    buildingNumber: "10",
};

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

function addressBlockHasData(b: ApplicantAddressBlock | undefined): b is ApplicantAddressBlock {
    if (!b) return false;
    return Boolean(
        b.country?.trim() ||
            b.postCode?.trim() ||
            b.townEn?.trim() ||
            b.town?.trim() ||
            b.streetEn?.trim() ||
            b.street?.trim() ||
            b.buildingNumber?.trim() ||
            b.formattedAddress?.trim()
    );
}

/**
 * Sumsub splits residential data: `addresses[]` comes from PoA docs; `address` is a single object
 * (e.g. from ID). `fixedInfo` mirrors `info` for user-entered data. Integration tests often hit
 * GREEN without a separate PoA step, leaving `addresses` empty.
 */
function pickAddressFromApplicantData(info: ApplicantDataInfo | undefined): ApplicantAddressBlock | undefined {
    if (!info) return undefined;
    for (const row of info.addresses ?? []) {
        if (addressBlockHasData(row)) return row;
    }
    if (addressBlockHasData(info.address)) return info.address;
    return undefined;
}

function resolveApplicantAddress(applicant: GetApplicantDataResponse): ApplicantAddressBlock | undefined {
    return (
        pickAddressFromApplicantData(applicant.info) ?? pickAddressFromApplicantData(applicant.fixedInfo)
    );
}

function streetAndNumberFromBlock(addr: ApplicantAddressBlock): string {
    const street = (addr.streetEn ?? addr.street ?? "").trim();
    const building = (addr.buildingNumber ?? "").trim();
    if (street && building) return `${street} ${building}`.trim();
    if (street) return street;
    if (building) return building;
    const formatted = addr.formattedAddress?.trim();
    return formatted ?? "";
}

function townFromBlock(addr: ApplicantAddressBlock): string {
    return (addr.townEn ?? addr.town ?? "").trim();
}

function regionFromBlock(addr: ApplicantAddressBlock): string {
    return (addr.stateCode ?? addr.stateEn ?? addr.state ?? "").trim();
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
    const addr =
        resolveApplicantAddress(applicant) ??
        (process.env.AZTEC_ENV === "testnet" ? TESTNET_TEMPLATE_ADDRESS : undefined);
    if (!addr) throw new Error("Applicant has no address");

    const birthday = normalizeBirthday(info.dob, "personal.birthday");
    if (!BIRTHDAY.test(birthday)) throw new Error("birthday must be YYYY-MM-DD");

    const streetAndNumber = streetAndNumberFromBlock(addr);
    const town = townFromBlock(addr);

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
            streetAndNumber: requireNonEmpty(streetAndNumber, "address.streetAndNumber"),
            postcode: requireNonEmpty(addr.postCode, "address.postcode"),
            town: requireNonEmpty(town, "address.town"),
            region: regionFromBlock(addr),
            country: normalizeCountry(addr.country ?? info.country, "address.country"),
        },
    };
}
