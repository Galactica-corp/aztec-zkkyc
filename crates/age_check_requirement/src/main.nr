/**
 * Age Check Requirement Contract
 *
 * Implements the requirement checker interface for zk certificates.
 * Checks that the user's age (from KYC data) meets a minimum threshold.
 * Uses block timestamp from context for the reference date.
 */

use dep::aztec::macros::aztec;

mod test;

#[aztec]
pub contract AgeCheckRequirement {
    use dep::aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        state_vars::PublicImmutable,
        utils::comparison::Comparator,
    };
    // Content type and layout constants (must match zk_certificate content module)
    global FIELD_CONTENT_TYPE_ZK_KYC: Field = 1;
    global KYC_PERSONAL_INDEX_BIRTHDAY: u32 = 3;
    global SECONDS_PER_YEAR: u64 = 31536000; // 365 * 86400 seconds per year

    #[storage]
    struct Storage<Context> {
        // Minimum age required (e.g. 18)
        age_threshold: PublicImmutable<u32, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(age_threshold: u32) {
        self.storage.age_threshold.initialize(age_threshold);
    }

    /**
     * Check requirements against certificate content.
     * Standardized interface for requirement checkers.
     * @param content_type - The certificate content type (e.g. CONTENT_TYPE_ZK_KYC)
     * @param content_note_0 - First content note data (KYC personal for ZK_KYC)
     * @param content_note_1 - Second content note data (KYC address for ZK_KYC)
     */
    #[external("private")]
    fn check_requirements(
        content_type: Field,
        content_note_0: [Field; 8],
        content_note_1: [Field; 8],
    ) {
        assert(
            content_type.eq(FIELD_CONTENT_TYPE_ZK_KYC),
            "Unsupported content type for age check",
        );

        let header = self.context.get_anchor_block_header();
        let reference_timestamp = header.global_variables.timestamp;

        let birth_timestamp = content_note_0[KYC_PERSONAL_INDEX_BIRTHDAY as u32];

        let age_seconds = Field::from(reference_timestamp) - birth_timestamp;
        let threshold = self.storage.age_threshold.read();
        let required_seconds = Field::from((threshold as u64) * SECONDS_PER_YEAR);
        // TODO: consider the day difference from leap years
        assert(
            dep::aztec::utils::comparison::compare(age_seconds, Comparator.GTE, required_seconds),
            "Age requirement not met",
        );
    }
}
