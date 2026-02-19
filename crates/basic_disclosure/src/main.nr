/**
 * Basic selective disclosure implementation.
 *
 * Emits a private event containing the certificate owner and surname
 * to one configured recipient.
 */

use dep::aztec::macros::aztec;

mod test;

#[aztec]
pub contract BasicDisclosure {
    use dep::aztec::{
        macros::events::event,
        macros::{functions::{external, initializer}, storage::storage},
        messages::message_delivery::MessageDelivery,
        protocol_types::address::AztecAddress,
        state_vars::PublicImmutable,
    };
    use dep::zk_certificate_content::{
        CONTENT_TYPE_ZK_KYC,
        KYC_PERSONAL_INDEX_SURNAME,
    };

    #[storage]
    struct Storage<Context> {
        recipient: PublicImmutable<AztecAddress, Context>,
    }

    #[event]
    struct BasicDisclosureEvent {
        from: AztecAddress,
        context: Field,
        surname: Field,
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
        content_type: Field,
        content_note_0: [Field; 8],
        _content_note_1: [Field; 8],
    ) {
        assert(
            content_type.eq(CONTENT_TYPE_ZK_KYC),
            "Unsupported content type for basic disclosure",
        );

        let recipient = self.storage.recipient.read();
        let surname = content_note_0[KYC_PERSONAL_INDEX_SURNAME];

        self.emit(BasicDisclosureEvent { from, context, surname }).deliver_to(
            recipient,
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );
    }
}
