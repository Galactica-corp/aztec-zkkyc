use dep::aztec::{
    protocol_types::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

use crate::CertificateRegistry;

// Setup function for certificate registry contract tests
// Returns: (TestEnvironment, contract_address, admin_address)
pub unconstrained fn setup_certificate_registry() -> (TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();

    let admin = env.create_light_account();

    let initializer_call_interface = CertificateRegistry::interface().constructor(admin);
    let contract_address = env.deploy("CertificateRegistry").with_public_initializer(
        admin,
        initializer_call_interface,
    );
    (env, contract_address, admin)
}
