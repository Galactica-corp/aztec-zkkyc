use crate::test::utils;
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;

use dep::zk_certificate::CertificateRegistry;

use crate::UseCaseExample;

// ============================================================================
// INITIALIZATION TESTS
// ============================================================================

// Test: Contract initialization sets admin correctly
#[test]
unconstrained fn test_initializer() {
    let (mut env, zk_certificate_registry_address, use_case_example_address, _) =
        utils::setup_test_env();

    env.public_context_at(use_case_example_address, |context| {
        let current_zk_certificate_registry =
            context.storage_read(UseCaseExample::storage_layout().zk_certificate_registry.slot);
        assert_eq(current_zk_certificate_registry, zk_certificate_registry_address);
    });
}

// ============================================================================
// Compliance integration test
// ============================================================================

// Test: Use case can check compliance with a ZK Certificate Registry
#[test]
unconstrained fn test_zk_certificate_integration() {
    let (mut env, zk_certificate_registry_address, use_case_example_address, admin) =
        utils::setup_test_env();
    let guardian = env.create_light_account();
    let user = env.create_light_account();
    let unique_id = Field::from(1);
    let revocation_nullifier = Field::from(1234561);

    env.call_public(
        admin,
        CertificateRegistry::at(zk_certificate_registry_address).whitelist_guardian(guardian),
    );
    env.call_private(
        guardian,
        CertificateRegistry::at(zk_certificate_registry_address).issue_certificate(
            user,
            unique_id,
            revocation_nullifier,
        ),
    );

    env.call_private(user, UseCaseExample::at(use_case_example_address).use_privately());
}

// // Test: User cannot proof that their certificate does not exist
// #[test(should_fail)]
// unconstrained fn test_fail_user_proof_certificate_non_existence() {
//     let (mut env, contract_address, _) = utils::setup_certificate_registry();
//     let user = env.create_light_account();

//     env.call_private(user, CertificateRegistry::at(contract_address).check_certificate());
// }
