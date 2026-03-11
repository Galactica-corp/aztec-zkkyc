import { Fr } from "@aztec/aztec.js/fields";
import { poseidon2Hash } from "@aztec/foundation/crypto/poseidon";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { IssueKycCertificateOptions, ZkKycInput } from "../types.js";

export const CONTENT_TYPE_ZK_KYC = new Fr(1);
export const KYC_NOTE_FIELD_COUNT = 7;
export const MAX_KYC_VERIFICATION_LEVEL = 2;
const ISO_3166_ALPHA3_PATTERN = /^[A-Z]{3}$/;
const ISO_3166_2_OPTIONAL_PATTERN = /^$|^[A-Z]{2}-[A-Z0-9]{1,6}$/;

export type ZkKycContentNote = [Fr, Fr, Fr, Fr, Fr, Fr, Fr];

export interface PreparedKycCertificateIssuance {
    userAddress: AztecAddress;
    uniqueId: Fr;
    revocationId: Fr;
    contentType: Fr;
    personalData: ZkKycContentNote;
    addressData: ZkKycContentNote;
}

export interface PrepareZkKycDependencies {
    hashStringToField(value: string): Promise<Fr>;
    createRandomField(): Fr;
    parseAddress(value: string): AztecAddress;
}

const defaultDependencies: PrepareZkKycDependencies = {
    async hashStringToField(value: string): Promise<Fr> {
        const hash = await poseidon2Hash([
            Fr.fromBufferReduce(Buffer.from(value.padEnd(32, "#"), "utf8")),
        ]);

        return new Fr(hash.toBigInt());
    },
    createRandomField() {
        return Fr.random();
    },
    parseAddress(value: string) {
        return AztecAddress.fromString(value);
    },
};

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
    const trimmed = value?.trim();
    if (!trimmed) {
        throw new Error(`${fieldName} is required`);
    }

    return trimmed;
}

function requireMatchingFormat(value: string, fieldName: string, pattern: RegExp, example: string): string {
    if (!pattern.test(value)) {
        throw new Error(`${fieldName} must use the expected format, for example ${example}`);
    }

    return value;
}

function asField(value: bigint | number | string | undefined, createRandomField: () => Fr, fieldName: string): Fr {
    if (value === undefined) {
        return createRandomField();
    }

    try {
        return new Fr(BigInt(value));
    } catch {
        throw new Error(`${fieldName} must be a valid field-compatible integer`);
    }
}

/**
 * Converts a YYYY-MM-DD birthday into the UTC unix timestamp expected by the Noir KYC layout.
 */
export function parseBirthdayToUnixTimestamp(value: string): bigint {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        throw new Error("birthday must be a valid ISO date in YYYY-MM-DD format");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const timestampMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const date = new Date(timestampMs);
    if (
        !Number.isFinite(timestampMs) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new Error("birthday must be a valid ISO date in YYYY-MM-DD format");
    }

    return BigInt(Math.floor(timestampMs / 1000));
}

async function buildPersonalData(
    kyc: ZkKycInput,
    hashStringToField: (value: string) => Promise<Fr>
): Promise<ZkKycContentNote> {
    const surname = requireNonEmptyString(kyc.personal.surname, "personal.surname");
    const forename = requireNonEmptyString(kyc.personal.forename, "personal.forename");
    const citizenship = requireMatchingFormat(
        requireNonEmptyString(kyc.personal.citizenship, "personal.citizenship"),
        "personal.citizenship",
        ISO_3166_ALPHA3_PATTERN,
        "DEU"
    );
    const middlename = kyc.personal.middlename?.trim() ?? "";
    const verificationLevel = kyc.personal.verificationLevel;
    if (!Number.isInteger(verificationLevel) || verificationLevel < 0 || verificationLevel > MAX_KYC_VERIFICATION_LEVEL) {
        throw new Error(`personal.verificationLevel must be an integer between 0 and ${MAX_KYC_VERIFICATION_LEVEL}`);
    }

    return [
        await hashStringToField(surname),
        await hashStringToField(forename),
        await hashStringToField(middlename),
        new Fr(parseBirthdayToUnixTimestamp(kyc.personal.birthday)),
        await hashStringToField(citizenship),
        new Fr(BigInt(verificationLevel)),
        new Fr(0),
    ];
}

async function buildAddressData(
    kyc: ZkKycInput,
    hashStringToField: (value: string) => Promise<Fr>
): Promise<ZkKycContentNote> {
    const streetAndNumber = requireNonEmptyString(kyc.address.streetAndNumber, "address.streetAndNumber");
    const postcode = requireNonEmptyString(kyc.address.postcode, "address.postcode");
    const town = requireNonEmptyString(kyc.address.town, "address.town");
    const country = requireMatchingFormat(
        requireNonEmptyString(kyc.address.country, "address.country"),
        "address.country",
        ISO_3166_ALPHA3_PATTERN,
        "DEU"
    );
    const region = requireMatchingFormat(
        kyc.address.region?.trim() ?? "",
        "address.region",
        ISO_3166_2_OPTIONAL_PATTERN,
        "DE-BE"
    );

    return [
        await hashStringToField(streetAndNumber),
        await hashStringToField(postcode),
        await hashStringToField(town),
        await hashStringToField(region),
        await hashStringToField(country),
        new Fr(0),
        new Fr(0),
    ];
}

/**
 * Validates a normalized ZK-KYC payload and converts it into the certificate registry call arguments.
 */
export async function prepareZkKycCertificateIssuance(
    options: Pick<IssueKycCertificateOptions, "kyc" | "uniqueId" | "revocationId">,
    dependencies: PrepareZkKycDependencies = defaultDependencies
): Promise<PreparedKycCertificateIssuance> {
    const userAddressValue =
        typeof options.kyc.userAddress === "string"
            ? dependencies.parseAddress(options.kyc.userAddress)
            : options.kyc.userAddress;

    return {
        userAddress: userAddressValue,
        uniqueId: asField(options.uniqueId, dependencies.createRandomField, "uniqueId"),
        revocationId: asField(options.revocationId, dependencies.createRandomField, "revocationId"),
        contentType: CONTENT_TYPE_ZK_KYC,
        personalData: await buildPersonalData(options.kyc, dependencies.hashStringToField),
        addressData: await buildAddressData(options.kyc, dependencies.hashStringToField),
    };
}
