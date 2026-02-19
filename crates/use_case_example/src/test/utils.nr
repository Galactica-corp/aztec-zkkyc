use dep::aztec::{
    protocol_types::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

use dep::age_check_requirement::AgeCheckRequirement;
use dep::basic_disclosure::BasicDisclosure;
use dep::shamir_disclosure::ShamirDisclosure;
use dep::zk_certificate::CertificateRegistry;

use crate::UseCaseExample;

pub global MAX_REQUIREMENT_CHECKERS: u32 = 4;
pub global MAX_DISCLOSURES: u32 = 4;
pub global DEFAULT_DISCLOSURE_CONTEXT: Field = 777;

pub fn configured_requirement_checker_addresses(
    age_check_address: AztecAddress,
) -> [AztecAddress; MAX_REQUIREMENT_CHECKERS] {
    [
        age_check_address,
        age_check_address,
        age_check_address,
        age_check_address,
    ]
}

pub fn configured_disclosure_addresses(
    basic_disclosure_address: AztecAddress,
    shamir_disclosure_address: AztecAddress,
) -> [AztecAddress; MAX_DISCLOSURES] {
    [
        basic_disclosure_address,
        shamir_disclosure_address,
        basic_disclosure_address,
        shamir_disclosure_address,
    ]
}

// Setup the test environment including user accounts and smart contracts
// Returns:
// (
//   TestEnvironment,
//   zk_certificate_registry_address,
//   use_case_example_address,
//   admin_address,
//   age_check_address,
//   basic_disclosure_address,
//   shamir_disclosure_address
// )
pub unconstrained fn setup_test_env(
) -> (
    TestEnvironment,
    AztecAddress,
    AztecAddress,
    AztecAddress,
    AztecAddress,
    AztecAddress,
    AztecAddress,
) {
    let mut env = TestEnvironment::new();

    let admin = env.create_light_account();

    let initializer_call_interface = CertificateRegistry::interface().constructor(admin);
    let zk_certificate_registry_address = env
        .deploy("@zk_certificate/CertificateRegistry")
        .with_public_initializer(admin, initializer_call_interface);

    let age_check_initializer = AgeCheckRequirement::interface().constructor(18u32);
    let age_check_address = env
        .deploy("@age_check_requirement/AgeCheckRequirement")
        .with_public_initializer(admin, age_check_initializer);

    let basic_disclosure_recipient = env.create_light_account();
    let basic_disclosure_initializer = BasicDisclosure::interface().constructor(
        basic_disclosure_recipient,
    );
    let basic_disclosure_address = env
        .deploy("@basic_disclosure/BasicDisclosure")
        .with_public_initializer(admin, basic_disclosure_initializer);

    let shamir_recipient_0 = env.create_light_account();
    let shamir_recipient_1 = env.create_light_account();
    let shamir_recipient_2 = env.create_light_account();
    let shamir_disclosure_initializer = ShamirDisclosure::interface().constructor(
        shamir_recipient_0,
        shamir_recipient_1,
        shamir_recipient_2,
    );
    let shamir_disclosure_address = env
        .deploy("@shamir_disclosure/ShamirDisclosure")
        .with_public_initializer(admin, shamir_disclosure_initializer);

    let initializer_call_interface = UseCaseExample::interface().constructor(
        zk_certificate_registry_address,
        configured_requirement_checker_addresses(age_check_address),
        1,
        configured_disclosure_addresses(basic_disclosure_address, shamir_disclosure_address),
        2,
        DEFAULT_DISCLOSURE_CONTEXT,
    );
    let use_case_example_address =
        env.deploy("UseCaseExample").with_public_initializer(admin, initializer_call_interface);

    (
        env,
        zk_certificate_registry_address,
        use_case_example_address,
        admin,
        age_check_address,
        basic_disclosure_address,
        shamir_disclosure_address,
    )
}
