// Shared content constants for ZK certificate-related contracts.

pub global CONTENT_TYPE_ZK_KYC: Field = 1;

// Number of content notes for KYC
pub global KYC_NUM_CONTENT_NOTES: u32 = 2;

// Content note indices (which note)
pub global KYC_CONTENT_INDEX_PERSONAL: u32 = 0;
pub global KYC_CONTENT_INDEX_ADDRESS: u32 = 1;

// Personal note field counts and indices (note index 0)
pub global KYC_PERSONAL_LEN: u32 = 6;
pub global KYC_PERSONAL_INDEX_SURNAME: u32 = 0;
pub global KYC_PERSONAL_INDEX_FORENAME: u32 = 1;
pub global KYC_PERSONAL_INDEX_MIDDLENAME: u32 = 2;
// Birthday: Unix timestamp at 00:00:00 UTC of the birth date. Must be divisible by 86400.
pub global KYC_PERSONAL_INDEX_BIRTHDAY: u32 = 3;
pub global KYC_PERSONAL_INDEX_CITIZENSHIP: u32 = 4;
pub global KYC_PERSONAL_INDEX_VERIFICATION_LEVEL: u32 = 5;

// Address note field counts and indices (note index 1, indices 5-7 unused)
pub global KYC_ADDRESS_LEN: u32 = 5;
pub global KYC_ADDRESS_INDEX_STREET_AND_NUMBER: u32 = 0;
pub global KYC_ADDRESS_INDEX_POSTCODE: u32 = 1;
pub global KYC_ADDRESS_INDEX_TOWN: u32 = 2;
pub global KYC_ADDRESS_INDEX_REGION: u32 = 3;
pub global KYC_ADDRESS_INDEX_COUNTRY: u32 = 4;
