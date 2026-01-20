use crate::CertificateRegistry;
use crate::test::utils;
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;
use dep::aztec::protocol_types::traits::Hash;

// ============================================================================
// INITIALIZATION TESTS
// ============================================================================

// Test: Contract initialization sets admin correctly
#[test]
unconstrained fn test_initializer() {
    let (mut env, contract_address, admin) = utils::setup_certificate_registry();

    env.public_context_at(contract_address, |context| {
        let current_admin = context.storage_read(CertificateRegistry::storage_layout().admin.slot);
        assert_eq(current_admin, admin);
    });
}

// ============================================================================
// GUARDIAN WHITELISTING TESTS
// ============================================================================

// Test: Whitelist a guardian
#[test]
unconstrained fn test_whitelist_guardian() {
    let (mut env, contract_address, admin) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();

    // Whitelist the guardian
    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));

    // Verify the guardian is whitelisted now
    env.public_context_at(contract_address, |context| {
        let guardian_whitelist_slot = derive_storage_slot_in_map(
            CertificateRegistry::storage_layout().guardian_whitelist.slot,
            guardian,
        );
        let guardian_whitelist = context.storage_read(guardian_whitelist_slot);
        assert_eq(guardian_whitelist, true);
    });
}

// Test: Non-admin cannot whitelist a guardian
#[test(should_fail)]
unconstrained fn test_fail_non_admin_whitelist_guardian() {
    let (mut env, contract_address, _) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();

    // Try to whitelist the guardian (should fail)
    env.call_public(guardian, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));
}

// Test: Remove a guardian from the whitelist
#[test]
unconstrained fn test_remove_guardian_from_whitelist() {
    let (mut env, contract_address, admin) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();

    // Whitelist the guardian
    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));

    // Remove the guardian from the whitelist
    env.call_public(
        admin,
        CertificateRegistry::at(contract_address).remove_guardian_from_whitelist(guardian),
    );

    // Verify the guardian is not whitelisted now
    env.public_context_at(contract_address, |context| {
        let guardian_whitelist_slot = derive_storage_slot_in_map(
            CertificateRegistry::storage_layout().guardian_whitelist.slot,
            guardian,
        );
        let guardian_whitelist = context.storage_read(guardian_whitelist_slot);
        assert_eq(guardian_whitelist, false);
    });
}

// Test: Non-admin cannot remove a guardian from the whitelist
#[test(should_fail)]
unconstrained fn test_fail_non_admin_remove_guardian_from_whitelist() {
    let (mut env, contract_address, _) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();

    // Try to remove the guardian from the whitelist (should fail)
    env.call_public(
        guardian,
        CertificateRegistry::at(contract_address).remove_guardian_from_whitelist(guardian),
    );
}

// ============================================================================
// CERTIFICATE ISSUANCE TESTS
// ============================================================================

// Test: Non-whitelisted guardian cannot issue a certificate
#[test(should_fail)]
unconstrained fn test_fail_non_whitelisted_guardian_issue_certificate() {
    let (mut env, contract_address, _) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();
    let user = env.create_light_account();
    let unique_id = Field::from(1);
    let revocation_nullifier = Field::from(2);

    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_nullifier,
        ),
    );
}

// Test: Whitelisted guardian can issue a certificate
#[test]
unconstrained fn test_whitelisted_guardian_issue_certificate() {
    let (mut env, contract_address, admin) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();
    let user = env.create_light_account();
    let unique_id = Field::from(1);
    let revocation_nullifier = Field::from(2);

    // Whitelist the guardian
    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));

    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_nullifier,
        ),
    );

    let certificates_count =
        env.simulate_utility(CertificateRegistry::at(contract_address).get_certificate_count(user));
    assert_eq(certificates_count, 1);
}

// ============================================================================
// CERTIFICATE PROOF OF EXISTENCE TESTS
// ============================================================================

// Test: User can proof that their certificate exists
#[test]
unconstrained fn test_user_proof_certificate_existence() {
    let (mut env, contract_address, admin) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();
    let user = env.create_light_account();
    let unique_id = Field::from(1);
    let revocation_nullifier = Field::from(1234561);

    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));
    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_nullifier,
        ),
    );

    env.call_private(user, CertificateRegistry::at(contract_address).check_certificate());
}

// Test: User cannot proof that their certificate does not exist
#[test(should_fail)]
unconstrained fn test_fail_user_proof_certificate_non_existence() {
    let (mut env, contract_address, _) = utils::setup_certificate_registry();
    let user = env.create_light_account();

    env.call_private(user, CertificateRegistry::at(contract_address).check_certificate());
}

// Test: User cannot proof certificate existence after the guardian is removed from the whitelist
#[test(should_fail)]
unconstrained fn test_fail_user_proof_certificate_existence_after_guardian_removal() {
    let (mut env, contract_address, admin) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();
    let user = env.create_light_account();
    let unique_id = Field::from(1);
    let revocation_nullifier = Field::from(1234561);

    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));
    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_nullifier,
        ),
    );
    env.call_public(
        admin,
        CertificateRegistry::at(contract_address).remove_guardian_from_whitelist(guardian),
    );

    env.call_private(user, CertificateRegistry::at(contract_address).check_certificate());
}

// ============================================================================
// CERTIFICATE REVOCATION TESTS
// ============================================================================

// Test: Guardian can revoke a certificate
#[test]
unconstrained fn test_guardian_revoke_certificate() {
    let (mut env, contract_address, admin) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();
    let user = env.create_light_account();
    let unique_id = Field::from(1);
    let revocation_nullifier = Field::from(1234561);

    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));
    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_nullifier,
        ),
    );

    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).revoke_certificate(revocation_nullifier),
    );

    // check that the nullifier is now in the nullifier set
    env.public_context(|context| {
        assert(context.nullifier_exists(revocation_nullifier, contract_address));
    });
}

// Test: User cannot use a certificate after revocation
#[test(should_fail)]
unconstrained fn test_fail_user_use_certificate_after_revocation() {
    let (mut env, contract_address, admin) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();
    let user = env.create_light_account();
    let unique_id = Field::from(1);
    let revocation_nullifier = Field::from(1234561);

    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));
    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_nullifier,
        ),
    );
    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).revoke_certificate(revocation_nullifier),
    );

    env.mine_block();

    env.call_private(user, CertificateRegistry::at(contract_address).check_certificate());
}
