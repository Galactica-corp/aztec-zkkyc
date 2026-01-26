use dep::aztec::{
    protocol_types::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

use dep::zk_certificate::CertificateRegistry;

use crate::UseCaseExample;

// Setup the test environment including user accounts and smart contracts
// Returns: (TestEnvironment, zk_certificate_registry_address, use_case_example_address, admin_address)
pub unconstrained fn setup_test_env() -> (TestEnvironment, AztecAddress, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();

    let admin = env.create_light_account();

    let initializer_call_interface = CertificateRegistry::interface().constructor(admin);
    let zk_certificate_registry_address = env
        .deploy("@zk_certificate/CertificateRegistry")
        .with_public_initializer(admin, initializer_call_interface);

    let initializer_call_interface =
        UseCaseExample::interface().constructor(zk_certificate_registry_address);
    let use_case_example_address =
        env.deploy("UseCaseExample").with_public_initializer(admin, initializer_call_interface);

    (env, zk_certificate_registry_address, use_case_example_address, admin)
}
