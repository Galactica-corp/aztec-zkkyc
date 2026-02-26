use crate::AgeCheckRequirement;
use dep::aztec::{
    protocol::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

// Must match zk_certificate content::CONTENT_TYPE_ZK_KYC
global CONTENT_TYPE_ZK_KYC: Field = 1;

// Birthday: 1990-06-15 00:00:00 UTC = 645494400
fn sample_kyc_content_adult() -> ([Field; 7], [Field; 7]) {
    let personal_data: [Field; 7] = [
        Field::from(1),
        Field::from(2),
        Field::from(0),
        Field::from(645494400),
        Field::from(3),
        Field::from(1),
        Field::from(0),
    ];
    let address_data: [Field; 7] = [
        Field::from(11),
        Field::from(12),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
    ];
    (personal_data, address_data)
}

// Birthday: 2010-01-01 00:00:00 UTC = 1262304000
fn sample_kyc_content_underage() -> ([Field; 7], [Field; 7]) {
    let (mut personal_data, address_data) = sample_kyc_content_adult();
    personal_data[3] = Field::from(1262304000);
    (personal_data, address_data)
}

// Setup: deploy AgeCheckRequirement with threshold
// Returns: (TestEnvironment, contract_address, admin)
pub unconstrained fn setup_age_check(
    threshold: u32,
) -> (TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();

    let admin = env.create_light_account();

    let initializer_call_interface = AgeCheckRequirement::interface().constructor(threshold);
    let contract_address = env.deploy("AgeCheckRequirement").with_public_initializer(
        admin,
        initializer_call_interface,
    );

    (env, contract_address, admin)
}

// Test: User with birthday 1990-06-15, threshold 18 - passes (default block ts ~2026)
#[test]
unconstrained fn test_age_check_passes_adult() {
    let (mut env, contract_address, admin) = setup_age_check(18u32);
    let (kyc_personal, kyc_address) = sample_kyc_content_adult();

    let call = AgeCheckRequirement::at(contract_address).check_requirements(
        CONTENT_TYPE_ZK_KYC,
        kyc_personal,
        kyc_address,
    );
    env.call_private(admin, call);
}

// Test: User with birthday 2010-01-01, threshold 18 - fails (default block ts ~2026, user 16)
#[test(should_fail)]
unconstrained fn test_age_check_fails_underage() {
    let (mut env, contract_address, admin) = setup_age_check(18u32);
    let (kyc_personal, kyc_address) = sample_kyc_content_underage();

    let call = AgeCheckRequirement::at(contract_address).check_requirements(
        CONTENT_TYPE_ZK_KYC,
        kyc_personal,
        kyc_address,
    );
    env.call_private(admin, call);
}

// Test: Unsupported content type - fails
#[test(should_fail)]
unconstrained fn test_age_check_fails_unsupported_content_type() {
    let (mut env, contract_address, admin) = setup_age_check(18u32);
    let (kyc_personal, kyc_address) = sample_kyc_content_adult();

    let unsupported_content_type = Field::from(99);
    let call = AgeCheckRequirement::at(contract_address).check_requirements(
        unsupported_content_type,
        kyc_personal,
        kyc_address,
    );
    env.call_private(admin, call);
}
