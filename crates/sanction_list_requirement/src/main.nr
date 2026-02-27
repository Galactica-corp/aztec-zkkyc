/**
 * Sanction List Requirement Contract
 *
 * Implements the requirement checker interface for zk certificates.
 * Ensures the user is not on a sanction list: neither their country (citizenship)
 * nor their combined surname+forename may be sanctioned.
 * Uses Map<Field, DelayedPublicMutable<bool>> for sanction entries so that
 * check_requirements (private) can read the lists.
 *
 * Country format: countries are identified by the Poseidon2 hash of the
 * ISO 3166-1 alpha-3 three-letter code (e.g. "USA", "DEU", "FRA").
 * Pass the hash of the UTF-8 encoded string when adding/removing countries.
 *
 * Name format: surname and forename are each passed as the Poseidon2 hash
 * of the name string (UTF-8). The contract combines them into a single
 * name_key internally.
 */

use ::aztec::macros::aztec;

mod test;

#[aztec]
pub contract SanctionListRequirement {
    use ::aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol::{address::AztecAddress, hash::poseidon2_hash_with_separator},
        state_vars::{DelayedPublicMutable, Map, PublicImmutable},
    };
    use dep::zk_certificate_content::{
        CONTENT_TYPE_ZK_KYC, KYC_PERSONAL_INDEX_CITIZENSHIP, KYC_PERSONAL_INDEX_FORENAME,
        KYC_PERSONAL_INDEX_SURNAME,
    };

    global SANCTION_DELAY: u64 = 12 * 60 * 60; // 12 hours

    #[storage]
    struct Storage<Context> {
        admin: PublicImmutable<AztecAddress, Context>,
        sanctioned_countries: Map<Field, DelayedPublicMutable<bool, SANCTION_DELAY, Context>, Context>,
        sanctioned_names: Map<Field, DelayedPublicMutable<bool, SANCTION_DELAY, Context>, Context>,
    }

    /**
     * Deploy the contract and set the admin who may add/remove sanction entries.
     */
    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        self.storage.admin.initialize(admin);
    }

    /**
     * Add a country to the sanction list. Only admin.
     * @param country - Poseidon2 hash of the ISO 3166-1 alpha-3 country code string (e.g. hash("USA")).
     */
    #[external("public")]
    fn add_sanctioned_country(country: Field) {
        assert(
            self.storage.admin.read().eq(self.msg_sender()),
            "Only admin can add sanctioned country",
        );
        self.storage.sanctioned_countries.at(country).schedule_value_change(true);
    }

    /**
     * Remove a country from the sanction list. Only admin.
     * @param country - Poseidon2 hash of the ISO 3166-1 alpha-3 country code string.
     */
    #[external("public")]
    fn remove_sanctioned_country(country: Field) {
        assert(
            self.storage.admin.read().eq(self.msg_sender()),
            "Only admin can remove sanctioned country",
        );
        self.storage.sanctioned_countries.at(country).schedule_value_change(false);
    }

    /**
     * Add a name (surname + forename) to the sanction list. Only admin.
     * @param surname - Poseidon2 hash of the surname string (UTF-8).
     * @param forename - Poseidon2 hash of the forename string (UTF-8).
     */
    #[external("public")]
    fn add_sanctioned_name(surname: Field, forename: Field) {
        assert(
            self.storage.admin.read().eq(self.msg_sender()),
            "Only admin can add sanctioned name",
        );
        let name_key = poseidon2_hash_with_separator([surname, forename], 0);
        self.storage.sanctioned_names.at(name_key).schedule_value_change(true);
    }

    /**
     * Remove a name (surname + forename) from the sanction list. Only admin.
     * @param surname - Poseidon2 hash of the surname string (UTF-8).
     * @param forename - Poseidon2 hash of the forename string (UTF-8).
     */
    #[external("public")]
    fn remove_sanctioned_name(surname: Field, forename: Field) {
        assert(
            self.storage.admin.read().eq(self.msg_sender()),
            "Only admin can remove sanctioned name",
        );
        let name_key = poseidon2_hash_with_separator([surname, forename], 0);
        self.storage.sanctioned_names.at(name_key).schedule_value_change(false);
    }

    /**
     * Check requirements against certificate content.
     * Fails if the user's country (citizenship) or combined name is on the sanction list.
     * Expects content_note_0 to contain Poseidon2 hashes for surname, forename, and
     * citizenship (country) in the KYC personal note layout.
     */
    #[external("private")]
    fn check_requirements(
        content_type: Field,
        content_note_0: [Field; 7],
        content_note_1: [Field; 7],
    ) {
        assert(
            content_type.eq(CONTENT_TYPE_ZK_KYC),
            "Unsupported content type for sanction check",
        );

        let country = content_note_0[KYC_PERSONAL_INDEX_CITIZENSHIP];
        assert_eq(
            self.storage.sanctioned_countries.at(country).get_current_value(),
            false,
            "User citizenship is on sanction list",
        );

        let surname = content_note_0[KYC_PERSONAL_INDEX_SURNAME];
        let forename = content_note_0[KYC_PERSONAL_INDEX_FORENAME];
        let name_key = poseidon2_hash_with_separator([surname, forename], 0);
        assert_eq(
            self.storage.sanctioned_names.at(name_key).get_current_value(),
            false,
            "User name is on sanction list",
        );
    }
}
