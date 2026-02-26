use crate::SanctionListRequirement;
use dep::aztec::{
    protocol::address::AztecAddress,
    test::helpers::test_environment::TestEnvironment,
};

// Must match zk_certificate_content::CONTENT_TYPE_ZK_KYC
global CONTENT_TYPE_ZK_KYC: Field = 1;
// Advance past SANCTION_DELAY (12h) so scheduled value change takes effect
global SANCTION_DELAY_SECONDS: u64 = 12 * 60 * 60;

// KYC personal: [surname, forename, middlename, birthday, citizenship, verification_level, _]
// Indices: 0=surname, 1=forename, 4=citizenship
fn sample_kyc_content_clean() -> ([Field; 7], [Field; 7]) {
    let personal_data: [Field; 7] = [
        Field::from(100),  // surname
        Field::from(200),  // forename
        Field::from(0),    // middlename
        Field::from(645494400),
        Field::from(5),    // citizenship (country code)
        Field::from(1),
        Field::from(0),
    ];
    let address_data: [Field; 7] = [
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
    ];
    (personal_data, address_data)
}

// Same as clean but citizenship = 99 (sanctioned in test)
fn sample_kyc_content_sanctioned_country() -> ([Field; 7], [Field; 7]) {
    let (mut personal_data, address_data) = sample_kyc_content_clean();
    personal_data[4] = Field::from(99);
    (personal_data, address_data)
}

// Setup: deploy SanctionListRequirement with admin
pub unconstrained fn setup_sanction_check(
) -> (TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();

    let admin = env.create_light_account();

    let initializer_call_interface = SanctionListRequirement::interface().constructor(admin);
    let contract_address = env.deploy("SanctionListRequirement").with_public_initializer(
        admin,
        initializer_call_interface,
    );

    (env, contract_address, admin)
}

#[test]
unconstrained fn test_sanction_check_passes_clean_user() {
    let (mut env, contract_address, admin) = setup_sanction_check();
    let (kyc_personal, kyc_address) = sample_kyc_content_clean();

    let call = SanctionListRequirement::at(contract_address).check_requirements(
        CONTENT_TYPE_ZK_KYC,
        kyc_personal,
        kyc_address,
    );
    env.call_private(admin, call);
}

#[test(should_fail)]
unconstrained fn test_sanction_check_fails_sanctioned_country() {
    let (mut env, contract_address, admin) = setup_sanction_check();
    let (kyc_personal, kyc_address) = sample_kyc_content_sanctioned_country();

    let sanctioned_country = Field::from(99);
    let add_country_call =
        SanctionListRequirement::at(contract_address).add_sanctioned_country(sanctioned_country);
    env.call_public(admin, add_country_call);

    env.mine_block();
    env.mine_block_at(env.last_block_timestamp() + SANCTION_DELAY_SECONDS + 1);

    let check_call = SanctionListRequirement::at(contract_address).check_requirements(
        CONTENT_TYPE_ZK_KYC,
        kyc_personal,
        kyc_address,
    );
    env.call_private(admin, check_call);
}

#[test(should_fail)]
unconstrained fn test_sanction_check_fails_sanctioned_name() {
    let (mut env, contract_address, admin) = setup_sanction_check();
    let surname = Field::from(100);
    let forename = Field::from(200);

    let add_name_call =
        SanctionListRequirement::at(contract_address).add_sanctioned_name(surname, forename);
    env.call_public(admin, add_name_call);

    env.mine_block();
    env.mine_block_at(env.last_block_timestamp() + SANCTION_DELAY_SECONDS + 1);

    let (kyc_personal, kyc_address) = sample_kyc_content_clean();
    let check_call = SanctionListRequirement::at(contract_address).check_requirements(
        CONTENT_TYPE_ZK_KYC,
        kyc_personal,
        kyc_address,
    );
    env.call_private(admin, check_call);
}

#[test(should_fail)]
unconstrained fn test_sanction_check_fails_unsupported_content_type() {
    let (mut env, contract_address, admin) = setup_sanction_check();
    let (kyc_personal, kyc_address) = sample_kyc_content_clean();

    let unsupported_content_type = Field::from(99);
    let call = SanctionListRequirement::at(contract_address).check_requirements(
        unsupported_content_type,
        kyc_personal,
        kyc_address,
    );
    env.call_private(admin, call);
}
