use dep::aztec::{
    protocol_types::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

use dep::age_check_requirement::AgeCheckRequirement;
use dep::zk_certificate::CertificateRegistry;

use crate::UseCaseExample;

// Setup the test environment including user accounts and smart contracts
// Returns: (TestEnvironment, zk_certificate_registry_address, use_case_example_address, admin_address, age_check_address)
pub unconstrained fn setup_test_env() -> (TestEnvironment, AztecAddress, AztecAddress, AztecAddress, AztecAddress) {
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

    let initializer_call_interface =
        UseCaseExample::interface().constructor(zk_certificate_registry_address, age_check_address);
    let use_case_example_address =
        env.deploy("UseCaseExample").with_public_initializer(admin, initializer_call_interface);

    (env, zk_certificate_registry_address, use_case_example_address, admin, age_check_address)
}
