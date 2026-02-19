use crate::BasicDisclosure;
use dep::aztec::{
    protocol_types::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

global CONTENT_TYPE_ZK_KYC: Field = 1;

fn sample_kyc_personal() -> [Field; 8] {
    [
        Field::from(111),
        Field::from(2),
        Field::from(0),
        Field::from(645494400),
        Field::from(3),
        Field::from(1),
        Field::from(0),
        Field::from(0),
    ]
}

fn sample_kyc_address() -> [Field; 8] {
    [
        Field::from(11),
        Field::from(12),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
    ]
}

pub unconstrained fn setup_basic_disclosure() -> (TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();
    let admin = env.create_light_account();
    let recipient = env.create_light_account();

    let initializer_call_interface = BasicDisclosure::interface().constructor(recipient);
    let contract_address = env.deploy("BasicDisclosure").with_public_initializer(
        admin,
        initializer_call_interface,
    );

    (env, contract_address, admin)
}

#[test]
unconstrained fn test_basic_disclosure_for_kyc_content() {
    let (mut env, contract_address, admin) = setup_basic_disclosure();
    let from = env.create_light_account();

    env.call_private(
        admin,
        BasicDisclosure::at(contract_address).disclose(
            from,
            Field::from(77),
            CONTENT_TYPE_ZK_KYC,
            sample_kyc_personal(),
            sample_kyc_address(),
        ),
    );
}

#[test(should_fail)]
unconstrained fn test_basic_disclosure_fails_for_unsupported_content_type() {
    let (mut env, contract_address, admin) = setup_basic_disclosure();
    let from = env.create_light_account();

    env.call_private(
        admin,
        BasicDisclosure::at(contract_address).disclose(
            from,
            Field::from(77),
            Field::from(99),
            sample_kyc_personal(),
            sample_kyc_address(),
        ),
    );
}
