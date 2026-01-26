/**
 * Use case example of a smart contract using the ZK Certificate Registry contract for compliance checks.
 */

use dep::aztec::macros::aztec;

mod test;

#[aztec]
pub contract UseCaseExample {
    use dep::aztec::macros::{functions::{external, initializer}, storage::storage};
    use dep::aztec::protocol_types::address::AztecAddress;
    use dep::aztec::state_vars::PublicMutable;

    #[storage]
    struct Storage<Context> {
        // Address of the ZK Certificate Registry contract where ZK KYC records proving compliance can be checked
        zk_certificate_registry: PublicMutable<AztecAddress, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(zk_certificate_registry: AztecAddress) {
        self.storage.zk_certificate_registry.write(zk_certificate_registry);
    }

    /**
     * Private usage that is checking compliance with a ZK Certificate Registry.
     */
    #[external("private")]
    fn use_privately() {
        let user = self.context.msg_sender().unwrap();

        // Custom use case logic would go here
    }
}
