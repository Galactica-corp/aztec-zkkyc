import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Fr } from "@aztec/aztec.js/fields";
import { poseidon2Hash } from "@aztec/foundation/crypto/poseidon";
import { prepareZkKycCertificateIssuance, parseBirthdayToUnixTimestamp } from "../../src/kyc/zkKyc.js";
import { createZkKycInput } from "../support/fixtures.js";

describe("zk KYC preparation", () => {
    it("parses a valid ISO birthday into a UTC unix timestamp", () => {
        expect(parseBirthdayToUnixTimestamp("1990-06-01")).toBe(644198400n);
    });

    it("rejects an invalid birthday", () => {
        expect(() => parseBirthdayToUnixTimestamp("1990-02-31")).toThrow(
            "birthday must be a valid ISO date in YYYY-MM-DD format"
        );
    });

    it("prepares fixed-size content note arrays and hashes string fields", async () => {
        const prepared = await prepareZkKycCertificateIssuance({
            kyc: createZkKycInput(),
            uniqueId: "11",
            revocationId: "22",
        });

        const expectedSurnameHash = new Fr((await poseidon2Hash([
            Fr.fromBufferReduce(Buffer.from("DOE".padEnd(32, "#"), "utf8")),
        ])).toBigInt());

        expect(prepared.userAddress.toString()).toBe(AztecAddress.ZERO.toString());
        expect(prepared.uniqueId.toBigInt()).toBe(11n);
        expect(prepared.revocationId.toBigInt()).toBe(22n);
        expect(prepared.contentType.toBigInt()).toBe(1n);
        expect(prepared.personalData).toHaveLength(7);
        expect(prepared.addressData).toHaveLength(7);
        expect(prepared.personalData[0].toBigInt()).toBe(expectedSurnameHash.toBigInt());
        expect(prepared.personalData[3].toBigInt()).toBe(644198400n);
        expect(prepared.personalData[5].toBigInt()).toBe(2n);
        expect(prepared.personalData[6].toBigInt()).toBe(0n);
        expect(prepared.addressData[5].toBigInt()).toBe(0n);
        expect(prepared.addressData[6].toBigInt()).toBe(0n);
    });

    it("uses empty strings for optional middlename and region fields", async () => {
        const prepared = await prepareZkKycCertificateIssuance({
            kyc: createZkKycInput({
                personal: {
                    surname: "DOE",
                    forename: "JANE",
                    birthday: "1990-06-01",
                    citizenship: "DEU",
                    verificationLevel: 2,
                },
                address: {
                    streetAndNumber: "MUSTERSTRASSE 10",
                    postcode: "10115",
                    town: "BERLIN",
                    country: "DEU",
                },
            }),
            uniqueId: "11",
            revocationId: "22",
        });

        const expectedEmptyHash = new Fr((await poseidon2Hash([
            Fr.fromBufferReduce(Buffer.from("".padEnd(32, "#"), "utf8")),
        ])).toBigInt());

        expect(prepared.personalData[2].toBigInt()).toBe(expectedEmptyHash.toBigInt());
        expect(prepared.addressData[3].toBigInt()).toBe(expectedEmptyHash.toBigInt());
    });

    it("rejects non-ISO alpha-3 citizenship and country codes", async () => {
        await expect(prepareZkKycCertificateIssuance({
            kyc: createZkKycInput({
                personal: {
                    surname: "DOE",
                    forename: "JANE",
                    middlename: "",
                    birthday: "1990-06-01",
                    citizenship: "DE",
                    verificationLevel: 2,
                },
            }),
            uniqueId: "11",
            revocationId: "22",
        })).rejects.toThrow("personal.citizenship must use the expected format, for example DEU");

        await expect(prepareZkKycCertificateIssuance({
            kyc: createZkKycInput({
                address: {
                    streetAndNumber: "MUSTERSTRASSE 10",
                    postcode: "10115",
                    town: "BERLIN",
                    region: "DE-BE",
                    country: "DE",
                },
            }),
            uniqueId: "11",
            revocationId: "22",
        })).rejects.toThrow("address.country must use the expected format, for example DEU");
    });

    it("rejects invalid ISO 3166-2 region codes", async () => {
        await expect(prepareZkKycCertificateIssuance({
            kyc: createZkKycInput({
                address: {
                    streetAndNumber: "MUSTERSTRASSE 10",
                    postcode: "10115",
                    town: "BERLIN",
                    region: "berlin",
                    country: "DEU",
                },
            }),
            uniqueId: "11",
            revocationId: "22",
        })).rejects.toThrow("address.region must use the expected format, for example DE-BE");
    });
});
