import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import type { AztecAddress } from "@aztec/stdlib/aztec-address";

export function createGuardianEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    return {
        AZTEC_ENV: "local-network",
        SECRET: Fr.random().toString(),
        SALT: Fr.random().toString(),
        SIGNING_KEY: GrumpkinScalar.random().toString(),
        ...overrides,
    };
}

export function createAddressStub(label = "0xguardian"): AztecAddress {
    const address = {
        equals: (other: unknown) => other === address,
        toString: () => label,
    } as unknown as AztecAddress;

    return address;
}

export function createRegisteredAddress(address: AztecAddress, alias = "guardian") {
    return {
        item: address,
        alias,
    };
}

export function createZkKycInput(overrides: Record<string, unknown> = {}) {
    return {
        userAddress: "0x0000000000000000000000000000000000000000000000000000000000000000",
        personal: {
            surname: "DOE",
            forename: "JANE",
            middlename: "",
            birthday: "1990-06-01",
            citizenship: "DEU",
            verificationLevel: 2,
        },
        address: {
            streetAndNumber: "MUSTERSTRASSE 10",
            postcode: "10115",
            town: "BERLIN",
            region: "DE-BE",
            country: "DEU",
        },
        ...overrides,
    };
}

export function restoreProcessEnv(snapshot: NodeJS.ProcessEnv) {
    process.env = { ...snapshot };
}
