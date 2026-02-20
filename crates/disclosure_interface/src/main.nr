/**
 * Disclosure interface for selective certificate disclosures.
 *
 * Defines the standardized private disclosure call that disclosure implementations
 * must expose for CertificateRegistry cross-contract calls.
 */

use dep::aztec::macros::aztec;

#[aztec]
pub contract DisclosureInterface {
    use dep::aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol_types::address::AztecAddress,
    };

    #[storage]
    struct Storage<Context> {}

    #[external("public")]
    #[initializer]
    fn constructor() {}

    /**
     * Disclose selected certificate content.
     * @param from - User whose certificate data is being disclosed
     * @param context - Use-case context passed through by the caller contract
     * @param guardian - Guardian that issued the used certificate
     * @param unique_id - Unique id of the used certificate
     * @param content_type - Certificate content type (e.g. ZK KYC)
     * @param content_note_0 - First content note payload
     * @param content_note_1 - Second content note payload
     */
    #[external("private")]
    fn disclose(
        _from: AztecAddress,
        _context: Field,
        _guardian: AztecAddress,
        _unique_id: Field,
        content_type: Field,
        _content_note_0: [Field; 8],
        _content_note_1: [Field; 8],
    ) {
        // Dummy check that is expected to fail if called directly.
        assert_eq(
            content_type,
            Field::from(123456789),
            "DisclosureInterface: call a concrete disclosure implementation instead.",
        );
    }
}
