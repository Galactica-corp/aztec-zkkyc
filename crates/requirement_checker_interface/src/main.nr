/**
 * Requirement checker interface for ZK certificates.
 *
 * Defines the standard interface that all requirement checkers must implement.
 * This contract is used as the type for cross-contract calls - the actual
 * implementation lives in concrete checkers (e.g. AgeCheckRequirement).
 *
 * Interface: check_requirements(content_type, content_note_0, content_note_1)
 */

use dep::aztec::macros::aztec;

#[aztec]
pub contract RequirementCheckerInterface {
    use dep::aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol_types::address::AztecAddress,
        state_vars::PublicImmutable,
    };

    #[storage]
    struct Storage<Context> {
        // Dummy field - this contract is never deployed, used only as call type
        _unused: PublicImmutable<u32, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor() {
        self.storage._unused.initialize(0);
    }

    /**
     * Check requirements against certificate content.
     * All requirement checkers must implement this with the exact same signature.
     * This body is never executed - we use this contract only for the interface.
     * Calls go to concrete implementations (e.g. AgeCheckRequirement) at the given address.
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
        // Dummy constraint so the circuit is non-empty (deploying this contract is forbidden)
        assert(content_type.eq(content_type), "Interface - use concrete checker");
    }
}
