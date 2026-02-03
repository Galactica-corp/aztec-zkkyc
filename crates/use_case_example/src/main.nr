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
    }

    #[external("public")]
    #[initializer]
    fn constructor(zk_certificate_registry: AztecAddress) {
        self.storage.zk_certificate_registry.initialize(zk_certificate_registry);
    }

    /**
     * Private usage that is checking compliance with a ZK Certificate Registry.
     * @param authwit_nonce The nonce of the private authentication witness of checking the certificate.
     */
    #[external("private")]
    fn use_privately(authwit_nonce: Field) {
        let user = self.context.msg_sender().unwrap();

        // call the ZK Certificate Registry to check compliance
        self.call(CertificateRegistry::at(self.storage.zk_certificate_registry.read())
            .check_certificate(user, authwit_nonce));

        // Custom use case logic would go here
    }
}
