use crate::ShamirDisclosure;
use ::aztec::{
    protocol::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

global CONTENT_TYPE_ZK_KYC: Field = 1;
global MAX_RECIPIENTS: u32 = 8;

fn sample_kyc_content() -> ([Field; 7], [Field; 7]) {
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

pub unconstrained fn setup_shamir_disclosure() -> (TestEnvironment, AztecAddress, AztecAddress) {
    setup_shamir_disclosure_with_params(5, 3)
}

pub unconstrained fn setup_shamir_disclosure_with_params(
    recipient_count: u32,
    threshold: u32,
) -> (TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();
    let admin = env.create_light_account();
    let recipients: [AztecAddress; MAX_RECIPIENTS] = [
        env.create_light_account(),
        env.create_light_account(),
        env.create_light_account(),
        env.create_light_account(),
        env.create_light_account(),
        env.create_light_account(),
        env.create_light_account(),
        env.create_light_account(),
    ];

    let initializer_call_interface = ShamirDisclosure::interface().constructor(
        recipient_count,
        threshold,
        recipients[0],
        recipients[1],
        recipients[2],
        recipients[3],
        recipients[4],
        recipients[5],
        recipients[6],
        recipients[7],
    );
    let contract_address = env.deploy("ShamirDisclosure").with_public_initializer(
        admin,
        initializer_call_interface,
    );

    (env, contract_address, admin)
}

#[test]
unconstrained fn test_shamir_disclosure_for_kyc_content() {
    let (mut env, contract_address, admin) = setup_shamir_disclosure();
    let (kyc_personal, kyc_address) = sample_kyc_content();
    let from = env.create_light_account();
    let guardian = env.create_light_account();

    env.call_private(
        admin,
        ShamirDisclosure::at(contract_address).disclose(
            from,
            Field::from(33),
            guardian,
            Field::from(1234),
            CONTENT_TYPE_ZK_KYC,
            kyc_personal,
            kyc_address,
        ),
    );
}

#[test]
unconstrained fn test_shamir_disclosure_for_1_of_1() {
    let (mut env, contract_address, admin) = setup_shamir_disclosure_with_params(1, 1);
    let (kyc_personal, kyc_address) = sample_kyc_content();
    let from = env.create_light_account();
    let guardian = env.create_light_account();

    env.call_private(
        admin,
        ShamirDisclosure::at(contract_address).disclose(
            from,
            Field::from(33),
            guardian,
            Field::from(1234),
            CONTENT_TYPE_ZK_KYC,
            kyc_personal,
            kyc_address,
        ),
    );
}

#[test]
unconstrained fn test_shamir_disclosure_for_8_of_8() {
    let (mut env, contract_address, admin) = setup_shamir_disclosure_with_params(8, 8);
    let (kyc_personal, kyc_address) = sample_kyc_content();
    let from = env.create_light_account();
    let guardian = env.create_light_account();

    env.call_private(
        admin,
        ShamirDisclosure::at(contract_address).disclose(
            from,
            Field::from(33),
            guardian,
            Field::from(1234),
            CONTENT_TYPE_ZK_KYC,
            kyc_personal,
            kyc_address,
        ),
    );
}

#[test(should_fail_with = "Unsupported content type for shamir disclosure")]
unconstrained fn test_shamir_disclosure_fails_for_unsupported_content_type() {
    let (mut env, contract_address, admin) = setup_shamir_disclosure();
    let (kyc_personal, kyc_address) = sample_kyc_content();
    let from = env.create_light_account();
    let guardian = env.create_light_account();

    env.call_private(
        admin,
        ShamirDisclosure::at(contract_address).disclose(
            from,
            Field::from(33),
            guardian,
            Field::from(1234),
            Field::from(88),
            kyc_personal,
            kyc_address,
        ),
    );
}
