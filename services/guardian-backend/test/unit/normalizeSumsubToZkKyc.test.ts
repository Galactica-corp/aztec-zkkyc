import { normalizeSumsubToZkKyc } from "../../src/domain/normalizeSumsubToZkKyc.js";
import type { GetApplicantDataResponse } from "../../src/sumsub/types.js";

const minimalApplicant: GetApplicantDataResponse = {
    info: {
        firstNameEn: "Jane",
        lastNameEn: "Doe",
        middleNameEn: "",
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

describe("normalizeSumsubToZkKyc", () => {
    it("maps full applicant to normalized KYC", () => {
        const result = normalizeSumsubToZkKyc(minimalApplicant, "0x1234");
        expect(result.userAddress).toBe("0x1234");
        expect(result.personal.surname).toBe("Doe");
        expect(result.personal.forename).toBe("Jane");
        expect(result.personal.middlename).toBe("");
        expect(result.personal.birthday).toBe("1990-06-01");
        expect(result.personal.citizenship).toBe("DEU");
        expect(result.personal.verificationLevel).toBe(2);
        expect(result.address.streetAndNumber).toContain("Musterstrasse");
        expect(result.address.postcode).toBe("10115");
        expect(result.address.town).toBe("Berlin");
        expect(result.address.region).toBe("DE-BE");
        expect(result.address.country).toBe("DEU");
    });

    it("normalizes country alpha-2 to alpha-3", () => {
        const applicant: GetApplicantDataResponse = {
            ...minimalApplicant,
            info: {
                ...minimalApplicant.info,
                country: "DE",
                addresses: [{ ...minimalApplicant.info!.addresses![0]!, country: "DE" }],
            },
        };
        const result = normalizeSumsubToZkKyc(applicant, "0x");
        expect(result.personal.citizenship).toBe("DEU");
        expect(result.address.country).toBe("DEU");
    });

    it("throws when address is missing", () => {
        const noAddress: GetApplicantDataResponse = {
            info: { ...minimalApplicant.info, addresses: [], address: undefined },
            metadata: [],
        };
        expect(() => normalizeSumsubToZkKyc(noAddress, "0x")).toThrow("no address");
    });

    it("uses singular info.address when addresses array is empty (ID-only / no PoA)", () => {
        const applicant: GetApplicantDataResponse = {
            info: {
                ...minimalApplicant.info,
                addresses: [],
                address: {
                    country: "DEU",
                    stateCode: "DE-BE",
                    town: "Berlin",
                    postCode: "10115",
                    street: "Musterstrasse",
                    buildingNumber: "10",
                },
            },
            metadata: [],
        };
        const result = normalizeSumsubToZkKyc(applicant, "0xabc");
        expect(result.address.streetAndNumber).toContain("Musterstrasse");
        expect(result.address.town).toBe("Berlin");
        expect(result.address.postcode).toBe("10115");
    });

    it("falls back to fixedInfo when info has no usable address", () => {
        const applicant: GetApplicantDataResponse = {
            info: {
                firstNameEn: "Jane",
                lastNameEn: "Doe",
                dob: "1990-06-01",
                country: "DEU",
                addresses: [],
            },
            fixedInfo: {
                addresses: [
                    {
                        country: "DEU",
                        townEn: "Munich",
                        postCode: "80331",
                        streetEn: "Viktualienmarkt",
                        buildingNumber: "1",
                    },
                ],
            },
            metadata: [],
        };
        const result = normalizeSumsubToZkKyc(applicant, "0x");
        expect(result.address.town).toBe("Munich");
        expect(result.address.postcode).toBe("80331");
    });

    it("throws when required personal field is missing", () => {
        const noSurname: GetApplicantDataResponse = {
            info: { ...minimalApplicant.info, lastNameEn: "" },
            metadata: [],
        };
        expect(() => normalizeSumsubToZkKyc(noSurname, "0x")).toThrow("surname");
    });

    it("throws when birthday is invalid", () => {
        const badDob: GetApplicantDataResponse = {
            info: { ...minimalApplicant.info, dob: "not-a-date" },
            metadata: [],
        };
        expect(() => normalizeSumsubToZkKyc(badDob, "0x")).toThrow("date");
    });
});
