use crate::CertificateRegistry;
use crate::content::CONTENT_TYPE_ZK_KYC;
use crate::test::utils;
use dep::age_check_requirement::AgeCheckRequirement;
use dep::aztec::protocol_types::address::AztecAddress;
use dep::requirement_checker_interface::CHECKER_TYPE_AGE;
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;
use dep::aztec::test::helpers::authwit::add_private_authwit_from_call;

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
    let revocation_id = Field::from(2);
    let (kyc_personal, kyc_address) = utils::sample_kyc_content();

    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_id,
            CONTENT_TYPE_ZK_KYC,
            kyc_personal,
            kyc_address,
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
    let revocation_id = Field::from(1234562);
    let (kyc_personal, kyc_address) = utils::sample_kyc_content();

    // Whitelist the guardian
    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));

    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_id,
            CONTENT_TYPE_ZK_KYC,
            kyc_personal,
            kyc_address,
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
    let revocation_id = Field::from(1234561);
    let (kyc_personal, kyc_address) = utils::sample_kyc_content();

    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));
    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_id,
            CONTENT_TYPE_ZK_KYC,
            kyc_personal,
            kyc_address,
        ),
    );

    let check_certificate_call =
        CertificateRegistry::at(contract_address).check_certificate(user, 0);
    add_private_authwit_from_call(env, user, user, check_certificate_call);
    env.call_private(user, check_certificate_call);
}

// Test: User can proof certificate existence with requirement check (age check)
#[test]
unconstrained fn test_user_proof_certificate_existence_with_requirements() {
    let (mut env, contract_address, admin) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();
    let user = env.create_light_account();
    let unique_id = Field::from(1);
    let revocation_id = Field::from(1234561);
    let (kyc_personal, kyc_address) = utils::sample_kyc_content();

    let age_check_initializer = AgeCheckRequirement::interface().constructor(18u32);
    let age_check_address = env
        .deploy("@age_check_requirement/AgeCheckRequirement")
        .with_public_initializer(admin, age_check_initializer);

    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));
    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_id,
            CONTENT_TYPE_ZK_KYC,
            kyc_personal,
            kyc_address,
        ),
    );

    let check_call = CertificateRegistry::at(contract_address).check_certificate_and_requirements(
        user,
        0,
        CHECKER_TYPE_AGE,
        age_check_address,
    );
    add_private_authwit_from_call(env, user, user, check_call);
    env.call_private(user, check_call);
}

// Test: User cannot pass the check when the certificate is missing
#[test(should_fail)]
unconstrained fn test_fail_user_proof_certificate_non_existence() {
    let (mut env, contract_address, _) = utils::setup_certificate_registry();
    let user = env.create_light_account();

    let check_certificate_call =
        CertificateRegistry::at(contract_address).check_certificate(user, 0);
    add_private_authwit_from_call(env, user, user, check_certificate_call);
    env.call_private(user, check_certificate_call);
}

// Test: User cannot proof certificate existence after the guardian is removed from the whitelist
#[test(should_fail)]
unconstrained fn test_fail_user_proof_certificate_existence_after_guardian_removal() {
    let (mut env, contract_address, admin) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();
    let user = env.create_light_account();
    let unique_id = Field::from(1);
    let revocation_id = Field::from(1234561);
    let (kyc_personal, kyc_address) = utils::sample_kyc_content();

    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));
    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_id,
            CONTENT_TYPE_ZK_KYC,
            kyc_personal,
            kyc_address,
        ),
    );
    env.call_public(
        admin,
        CertificateRegistry::at(contract_address).remove_guardian_from_whitelist(guardian),
    );

    let check_certificate_call =
        CertificateRegistry::at(contract_address).check_certificate(user, 0);
    add_private_authwit_from_call(env, user, user, check_certificate_call);
    env.call_private(user, check_certificate_call);
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
    let revocation_id = Field::from(1234561);
    let (kyc_personal, kyc_address) = utils::sample_kyc_content();

    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));
    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_id,
            CONTENT_TYPE_ZK_KYC,
            kyc_personal,
            kyc_address,
        ),
    );

    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).revoke_certificate(revocation_id),
    );

    // TODO: Check revocation status (not sure how to get the scheduled storage value for a delayed public mutable)
}

// Test: User cannot use a certificate after revocation
#[test(should_fail)]
unconstrained fn test_fail_user_use_certificate_after_revocation() {
    let (mut env, contract_address, admin) = utils::setup_certificate_registry();
    let guardian = env.create_light_account();
    let user = env.create_light_account();
    let unique_id = Field::from(1);
    let revocation_id = Field::from(1234561);
    let (kyc_personal, kyc_address) = utils::sample_kyc_content();

    env.call_public(admin, CertificateRegistry::at(contract_address).whitelist_guardian(guardian));
    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).issue_certificate(
            user,
            unique_id,
            revocation_id,
            CONTENT_TYPE_ZK_KYC,
            kyc_personal,
            kyc_address,
        ),
    );
    env.call_private(
        guardian,
        CertificateRegistry::at(contract_address).revoke_certificate(revocation_id),
    );

    env.mine_block();
    env.mine_block_at(env.last_block_timestamp() + 24 * 60 * 60); // 24 hours from now to pass the delay

    let check_certificate_call =
        CertificateRegistry::at(contract_address).check_certificate(user, 0);
    add_private_authwit_from_call(env, user, user, check_certificate_call);
    env.call_private(user, check_certificate_call);
}
