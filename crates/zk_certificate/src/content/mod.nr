// Content types for certificates. Maps to KnownZkCertStandard:
// 1 = ZkKYC (gip1), 2 = ArbitraryData (gip2), 3 = Twitter (gip3),
// 4 = Rey (gip4), 5 = DEX (gip5), 6 = CEX (gip6), 7 = Telegram (gip7).
// Content is stored as a fixed array of Fields; each content type packs into it.

pub mod kyc_layout;

// Content type discriminants matching KnownZkCertStandard
pub global CONTENT_TYPE_ZK_KYC: Field = 1;
pub global CONTENT_TYPE_ARBITRARY_DATA: Field = 2;
pub global CONTENT_TYPE_TWITTER: Field = 3;
pub global CONTENT_TYPE_REY: Field = 4;
pub global CONTENT_TYPE_DEX: Field = 5;
pub global CONTENT_TYPE_CEX: Field = 6;
pub global CONTENT_TYPE_TELEGRAM: Field = 7;

// Number of Fields for KYC content (surname through country)
pub global CONTENT_SIZE_KYC: u32 = 13;
