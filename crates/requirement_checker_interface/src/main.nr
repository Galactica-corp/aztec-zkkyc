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
    use dep::aztec::macros::{functions::{external, initializer}, storage::storage};

    #[storage]
    struct Storage<Context> {}

    #[external("public")]
    #[initializer]
    fn constructor() {}

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
        // Dummy check that is supposed to fail. However and obvious fail leads to a compile error
        // (Assertion failed: (!result.empty()) Reason   : split_into_mul_quad_gates: resulted in zero gates. This means that there is an expression with no  multiplication terms and no linear terms.)
        assert_eq(
            content_type,
            Field::from(123456789),
            "RequirementCheckerInterface: Don't call the generic requirement interface. Implement the concrete checker instead and call that.",
        );
    }
}
