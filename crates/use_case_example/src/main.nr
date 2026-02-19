/**
 * Use case example of a smart contract using the ZK Certificate Registry contract for compliance checks.
 */

use dep::aztec::macros::aztec;

mod test;

#[aztec]
pub contract UseCaseExample {
    use dep::aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol_types::address::AztecAddress,
        state_vars::PublicImmutable,
    };
    use dep::zk_certificate::CertificateRegistry;

    global MAX_REQUIREMENT_CHECKERS: u32 = 4;
    global MAX_DISCLOSURES: u32 = 4;

    #[storage]
    struct Storage<Context> {
        // Address of the ZK Certificate Registry contract where ZK KYC records proving compliance can be checked
        zk_certificate_registry: PublicImmutable<AztecAddress, Context>,

        // Configurable list of requirement checker contracts
        requirement_checker_addresses: PublicImmutable<[AztecAddress; MAX_REQUIREMENT_CHECKERS], Context>,
        requirement_checker_count: PublicImmutable<u32, Context>,

        // Configurable list of disclosure contracts
        disclosure_contract_addresses: PublicImmutable<[AztecAddress; MAX_DISCLOSURES], Context>,
        disclosure_contract_count: PublicImmutable<u32, Context>,

        // Context forwarded to the disclosure contracts
        disclosure_context: PublicImmutable<Field, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(
        zk_certificate_registry: AztecAddress,
        requirement_checker_addresses: [AztecAddress; MAX_REQUIREMENT_CHECKERS],
        requirement_checker_count: u32,
        disclosure_contract_addresses: [AztecAddress; MAX_DISCLOSURES],
        disclosure_contract_count: u32,
        disclosure_context: Field,
    ) {
        assert(
            requirement_checker_count <= MAX_REQUIREMENT_CHECKERS,
            "Too many requirement checkers",
        );
        assert(disclosure_contract_count <= MAX_DISCLOSURES, "Too many disclosures");

        self.storage.zk_certificate_registry.initialize(zk_certificate_registry);
        self.storage.requirement_checker_addresses.initialize(requirement_checker_addresses);
        self.storage.requirement_checker_count.initialize(requirement_checker_count);
        self.storage.disclosure_contract_addresses.initialize(disclosure_contract_addresses);
        self.storage.disclosure_contract_count.initialize(disclosure_contract_count);
        self.storage.disclosure_context.initialize(disclosure_context);
    }

    /**
     * Private usage that is checking compliance with a ZK Certificate Registry and requirement checkers.
     * @param authwit_nonce The nonce of the private authentication witness of checking the certificate.
     */
    #[external("private")]
    fn use_privately(authwit_nonce: Field) {
        let user = self.context.msg_sender().unwrap();

        self.call(
            CertificateRegistry::at(self.storage.zk_certificate_registry.read())
                .check_certificate_and_requirements(
                    user,
                    authwit_nonce,
                    self.storage.requirement_checker_addresses.read(),
                    self.storage.requirement_checker_count.read(),
                    self.storage.disclosure_contract_addresses.read(),
                    self.storage.disclosure_contract_count.read(),
                    self.storage.disclosure_context.read(),
                ),
        );

        // Custom use case logic would go here
    }
}
