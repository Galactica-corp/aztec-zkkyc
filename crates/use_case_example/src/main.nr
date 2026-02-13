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

    #[storage]
    struct Storage<Context> {
        // Address of the ZK Certificate Registry contract where ZK KYC records proving compliance can be checked
        zk_certificate_registry: PublicImmutable<AztecAddress, Context>,

        // Address of the Age Check Requirement contract
        age_check_requirement: PublicImmutable<AztecAddress, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(
        zk_certificate_registry: AztecAddress,
        age_check_requirement: AztecAddress,
    ) {
        self.storage.zk_certificate_registry.initialize(zk_certificate_registry);
        self.storage.age_check_requirement.initialize(age_check_requirement);
    }

    /**
     * Private usage that is checking compliance with a ZK Certificate Registry and requirement checkers.
     * @param authwit_nonce The nonce of the private authentication witness of checking the certificate.
     */
    #[external("private")]
    fn use_privately(authwit_nonce: Field) {
        let user = self.context.msg_sender().unwrap();
        let age_check = self.storage.age_check_requirement.read();

        self.call(
            CertificateRegistry::at(self.storage.zk_certificate_registry.read())
                .check_certificate_and_requirements(user, authwit_nonce, age_check),
        );

        // Custom use case logic would go here
    }
}
