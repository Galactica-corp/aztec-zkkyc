/**
 * Basic selective disclosure implementation.
 *
 * Emits a private event containing the certificate owner, issuing guardian,
 * and certificate unique id to one configured recipient.
 */

use dep::aztec::macros::aztec;

mod test;

#[aztec]
pub contract BasicDisclosure {
    use dep::aztec::{
        macros::events::event,
        macros::{functions::{external, initializer}, storage::storage},
        messages::message_delivery::MessageDelivery,
        protocol::address::AztecAddress,
        state_vars::PublicImmutable,
    };
    use dep::zk_certificate_content::CONTENT_TYPE_ZK_KYC;

    #[storage]
    struct Storage<Context> {
        recipient: PublicImmutable<AztecAddress, Context>,
    }

    #[event]
    struct BasicDisclosureEvent {
        from: AztecAddress,
        context: Field,
        guardian: AztecAddress,
        unique_id: Field,
    }

    #[external("public")]
    #[initializer]
    fn constructor(recipient: AztecAddress) {
        self.storage.recipient.initialize(recipient);
    }

    #[external("private")]
    fn disclose(
        from: AztecAddress,
        context: Field,
        guardian: AztecAddress,
        unique_id: Field,
        content_type: Field,
        _content_note_0: [Field; 8],
        _content_note_1: [Field; 8],
    ) {
        assert(
            content_type.eq(CONTENT_TYPE_ZK_KYC),
            "Unsupported content type for basic disclosure",
        );

        let recipient = self.storage.recipient.read();

        self.emit(BasicDisclosureEvent { from, context, guardian, unique_id }).deliver_to(
            recipient,
            MessageDelivery.ONCHAIN_CONSTRAINED,
        );
    }
}
