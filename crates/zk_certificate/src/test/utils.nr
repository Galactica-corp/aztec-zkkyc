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

// Re-export sample_kyc_content for tests
pub unconstrained fn sample_kyc_content() -> ([Field; 8], [Field; 8]) {
    let personal_data: [Field; 8] = [
        Field::from(1),
        Field::from(2),
        Field::from(0),
        Field::from(1990),
        Field::from(6),
        Field::from(15),
        Field::from(3),
        Field::from(1),
    ];
    let address_data = [
        Field::from(11),
        Field::from(12),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
        Field::from(0),
    ];
    (personal_data, address_data)
}
