import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import { resolveNetworkConfig } from "../../src/config/networkConfig.js";

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

export function getLocalNetworkConfig() {
    return resolveNetworkConfig({ aztecEnv: "local-network" });
}

export function restoreProcessEnv(snapshot: NodeJS.ProcessEnv) {
    process.env = { ...snapshot };
}
