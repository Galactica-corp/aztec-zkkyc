/**
 * Normalized ZK-KYC payload shape accepted by guardian-aztec-connect.
 * Mirrors ZkKycInput so we can validate and map without depending on the SDK in the normalizer layer.
 */
export interface NormalizedZkKycPersonal {
    surname: string;
    forename: string;
    middlename?: string;
    birthday: string;
    citizenship: string;
    verificationLevel: number;
}

export interface NormalizedZkKycAddress {
    streetAndNumber: string;
    postcode: string;
    town: string;
    region?: string;
    country: string;
}

export interface NormalizedZkKyc {
    userAddress: string;
    personal: NormalizedZkKycPersonal;
    address: NormalizedZkKycAddress;
}
