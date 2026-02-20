/**
 * Use case example of a smart contract using the ZK Certificate Registry contract for compliance checks.
 */

use dep::aztec::macros::aztec;

mod test;

#[aztec]
pub contract UseCaseExample {
    use dep::aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol::address::AztecAddress,
        state_vars::PublicImmutable,
    };
    use dep::zk_certificate::CertificateRegistry;

    #[storage]
    struct Storage<Context> {
        // Address of the ZK Certificate Registry contract where ZK KYC records proving compliance can be checked
        zk_certificate_registry: PublicImmutable<AztecAddress, Context>,

        // Requirement checker contract address
        requirement_checker_address: PublicImmutable<AztecAddress, Context>,

        // Disclosure contract address
        disclosure_contract_address: PublicImmutable<AztecAddress, Context>,

        // Context forwarded to the disclosure contracts
        disclosure_context: PublicImmutable<Field, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(
        zk_certificate_registry: AztecAddress,
        requirement_checker_address: AztecAddress,
        disclosure_contract_address: AztecAddress,
        disclosure_context: Field,
    ) {
        self.storage.zk_certificate_registry.initialize(zk_certificate_registry);
        self.storage.requirement_checker_address.initialize(requirement_checker_address);
        self.storage.disclosure_contract_address.initialize(disclosure_contract_address);
        self.storage.disclosure_context.initialize(disclosure_context);
    }

    /**
     * Private usage that is checking compliance with a ZK Certificate Registry and requirement checkers.
     * @param authwit_nonce The nonce of the private authentication witness of checking the certificate.
     */
    #[external("private")]
    fn use_privately(authwit_nonce: Field) {
        let user = self.msg_sender();

        self.call(
            CertificateRegistry::at(self.storage.zk_certificate_registry.read())
                .check_certificate_and_requirements(
                    user,
                    authwit_nonce,
                    self.storage.requirement_checker_address.read(),
                    self.storage.disclosure_contract_address.read(),
                    self.storage.disclosure_context.read(),
                ),
        );

        // Custom use case logic would go here
    }
}
