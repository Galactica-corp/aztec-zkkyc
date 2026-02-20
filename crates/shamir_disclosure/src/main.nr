/**
 * Shamir-like threshold selective disclosure.
 *
 * Initial implementation for 2-of-3 disclosure shards of one secret field
 * (surname in KYC personal note). Shares are distributed as private events
 * to three configured recipients.
 */

use dep::aztec::macros::aztec;

mod test;

#[aztec]
pub contract ShamirDisclosure {
    use dep::aztec::{
        macros::events::event,
        macros::{functions::{external, initializer}, storage::storage},
        messages::message_delivery::MessageDelivery,
        protocol_types::address::AztecAddress,
        state_vars::PublicImmutable,
    };

    global FIELD_CONTENT_TYPE_ZK_KYC: Field = 1;
    global KYC_PERSONAL_INDEX_SURNAME: u32 = 0;
    global SHARD_COEFF_SALT: u32 = 17;

    #[storage]
    struct Storage<Context> {
        recipient_0: PublicImmutable<AztecAddress, Context>,
        recipient_1: PublicImmutable<AztecAddress, Context>,
        recipient_2: PublicImmutable<AztecAddress, Context>,
    }

    #[event]
    struct ShamirDisclosureShardEvent {
        from: AztecAddress,
        context: Field,
        shard_x: Field,
        shard_y: Field,
    }

    #[external("public")]
    #[initializer]
    fn constructor(recipient_0: AztecAddress, recipient_1: AztecAddress, recipient_2: AztecAddress) {
        self.storage.recipient_0.initialize(recipient_0);
        self.storage.recipient_1.initialize(recipient_1);
        self.storage.recipient_2.initialize(recipient_2);
    }

    #[external("private")]
    fn disclose(
        from: AztecAddress,
        context: Field,
        _guardian: AztecAddress,
        _unique_id: Field,
        content_type: Field,
        content_note_0: [Field; 8],
        _content_note_1: [Field; 8],
    ) {
        assert(
            content_type.eq(FIELD_CONTENT_TYPE_ZK_KYC),
            "Unsupported content type for shamir disclosure",
        );

        let secret = content_note_0[KYC_PERSONAL_INDEX_SURNAME];
        // Simple 2-of-3 linear polynomial share generation:
        // y = secret + a*x, where a is context-derived.
        let coeff = context + Field::from(SHARD_COEFF_SALT);
        let x_1 = Field::from(1);
        let x_2 = Field::from(2);
        let x_3 = Field::from(3);
        let y_1 = secret + coeff * x_1;
        let y_2 = secret + coeff * x_2;
        let y_3 = secret + coeff * x_3;

        self.emit(
            ShamirDisclosureShardEvent {
                from,
                context,
                shard_x: x_1,
                shard_y: y_1,
            },
        ).deliver_to(self.storage.recipient_0.read(), MessageDelivery.CONSTRAINED_ONCHAIN);

        self.emit(
            ShamirDisclosureShardEvent {
                from,
                context,
                shard_x: x_2,
                shard_y: y_2,
            },
        ).deliver_to(self.storage.recipient_1.read(), MessageDelivery.CONSTRAINED_ONCHAIN);

        self.emit(
            ShamirDisclosureShardEvent {
                from,
                context,
                shard_x: x_3,
                shard_y: y_3,
            },
        ).deliver_to(self.storage.recipient_2.read(), MessageDelivery.CONSTRAINED_ONCHAIN);
    }
}
