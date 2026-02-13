use crate::test::utils;
use dep::aztec::test::helpers::authwit::add_private_authwit_from_call;
use dep::zk_certificate::{CertificateRegistry, content::CONTENT_TYPE_ZK_KYC, sample_kyc_content};

use crate::UseCaseExample;

global AUTHWIT_NONCE: Field = 456789;

// ============================================================================
// INITIALIZATION TESTS
// ============================================================================

// Test: Contract initialization sets admin correctly
#[test]
unconstrained fn test_initializer() {
    let (mut env, zk_certificate_registry_address, use_case_example_address, _, _) =
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

// Test: Use case can check compliance with a ZK Certificate Registry and age requirement.
#[test]
unconstrained fn test_zk_certificate_integration() {
    let (mut env, zk_certificate_registry_address, use_case_example_address, admin, age_check_address) =
        utils::setup_test_env();
    let guardian = env.create_light_account();
    let user = env.create_contract_account(); // use contract account to support authwit
    let unique_id = Field::from(1);
    let revocation_nullifier = Field::from(1234561);

    let (kyc_personal, kyc_address) = sample_kyc_content();

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
            CONTENT_TYPE_ZK_KYC,
            kyc_personal,
            kyc_address,
        ),
    );

    // Default block timestamp (~2026) is sufficient for adult (birthday 1990-06-15)

    // Prepare authwit for checking the certificate and requirements.
    let check_call = CertificateRegistry::at(zk_certificate_registry_address)
        .check_certificate_and_requirements(user, AUTHWIT_NONCE, age_check_address);
    add_private_authwit_from_call(env, user, use_case_example_address, check_call);

    env.call_private(user, UseCaseExample::at(use_case_example_address).use_privately(AUTHWIT_NONCE));
}

// Test: User cannot proof that their certificate does not exist
#[test(should_fail)]
unconstrained fn test_fail_user_proof_certificate_non_existence() {
    let (mut env, zk_certificate_registry_address, use_case_example_address, _, age_check_address)
         = utils::setup_test_env();
    let user = env.create_contract_account(); // use contract account to support authwit

    let check_call = CertificateRegistry::at(zk_certificate_registry_address)
        .check_certificate_and_requirements(user, AUTHWIT_NONCE, age_check_address);
    add_private_authwit_from_call(env, user, use_case_example_address, check_call);

    env.call_private(user, UseCaseExample::at(use_case_example_address).use_privately(AUTHWIT_NONCE));
}

// Test: User with underage KYC data fails the requirement check
#[test(should_fail)]
unconstrained fn test_fail_underage_user() {
    let (mut env, zk_certificate_registry_address, use_case_example_address, admin, age_check_address) =
        utils::setup_test_env();
    let guardian = env.create_light_account();
    let user = env.create_contract_account();

    let unique_id = Field::from(2);
    let revocation_nullifier = Field::from(1234562);

    // Underage: birthday 2020-01-01 = 1577836800
    let kyc_personal_underage: [Field; 8] = [
        Field::from(1),
        Field::from(2),
        Field::from(0),
        Field::from(1577836800),
        Field::from(3),
        Field::from(1),
        Field::from(0),
        Field::from(0),
    ];
    let kyc_address: [Field; 8] = [
        Field::from(11),
        Field::from(12),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
    ];

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
            CONTENT_TYPE_ZK_KYC,
            kyc_personal_underage,
            kyc_address,
        ),
    );

    // Default block timestamp (~2026): user born 2020-01-01 is 16, under threshold 18

    let check_call = CertificateRegistry::at(zk_certificate_registry_address)
        .check_certificate_and_requirements(user, AUTHWIT_NONCE, age_check_address);
    add_private_authwit_from_call(env, user, use_case_example_address, check_call);

    env.call_private(user, UseCaseExample::at(use_case_example_address).use_privately(AUTHWIT_NONCE));
}
