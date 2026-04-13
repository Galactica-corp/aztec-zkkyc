import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { Fr } from '@aztec/aztec.js/fields';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { FPCFeePaymentMethod, registerPrivateContract } from '@wonderland/aztec-fee-payment';
import { getSponsoredFPCInstance } from './sponsored_fpc.js';

function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required env var ${name}`);
    }
    return value;
}

/**
 * True only when explicitly running with `AZTEC_ENV=mainnet`.
 *
 * Note: the repo's `config/` currently ships `local-network.json` + `testnet.json`;
 * using `config/config.ts` for mainnet detection would fail on import.
 */
export function isAztecMainnetEnv(): boolean {
    return process.env.AZTEC_ENV === 'mainnet';
}

/**
 * Returns the FPC address that pays for fees in the current environment.
 *
 * - On `AZTEC_ENV=mainnet`, derives/registers the deterministic Private FPC using `PRIVATE_FPC_SALT`.
 * - Otherwise, uses the canonical SponsoredFPC address (available on local network + testnet).
 */
export async function getFpcAddressForFees(wallet: Wallet): Promise<AztecAddress> {
    if (isAztecMainnetEnv()) {
        const salt = Fr.fromString(requiredEnv('PRIVATE_FPC_SALT'));
        const fpc = await registerPrivateContract(wallet, salt);
        return fpc.address;
    }

    return (await getSponsoredFPCInstance()).address;
}

export async function getFeePaymentMethodForTxFees(
    wallet: Wallet,
): Promise<{
    fpcAddress: Awaited<ReturnType<typeof getFpcAddressForFees>>;
    paymentMethod: SponsoredFeePaymentMethod | FPCFeePaymentMethod;
}> {
    if (isAztecMainnetEnv()) {
        const fpcAddress = await getFpcAddressForFees(wallet);
        return {
            fpcAddress,
            paymentMethod: new FPCFeePaymentMethod(fpcAddress),
        };
    }

    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    return {
        fpcAddress: sponsoredFPC.address,
        paymentMethod: new SponsoredFeePaymentMethod(sponsoredFPC.address),
    };
}

