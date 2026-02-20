/**
 * Threshold-based selective disclosure for KYC data.
 *
 * The contract emits deterministic Shamir-like shards of one secret field
 * (`content_note_0[surname]`) to a configured recipient set. The threshold
 * controls the polynomial degree (`threshold - 1`) used for shard generation.
 */

use dep::aztec::macros::aztec;

mod test;

#[aztec]
pub contract ShamirDisclosure {
    use dep::aztec::{
        macros::{events::event, functions::{external, initializer}, storage::storage},
        messages::message_delivery::MessageDelivery,
        protocol_types::address::AztecAddress,
        state_vars::{Map, PublicImmutable},
    };

    global FIELD_CONTENT_TYPE_ZK_KYC: Field = 1;
    global KYC_PERSONAL_INDEX_SURNAME: u32 = 0;
    global SHARD_COEFF_SALT: u32 = 17;
    global MAX_RECIPIENTS: u32 = 8;

    #[storage]
    struct Storage<Context> {
        recipient_count: PublicImmutable<u32, Context>,
        threshold: PublicImmutable<u32, Context>,
        recipients: Map<u32, PublicImmutable<AztecAddress, Context>, Context>,
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
    /**
     * Configure recipient set and reconstruction threshold.
     *
     * The recipient list is passed as fixed parameters (`recipient_0..recipient_7`)
     * instead of a dynamic array because this initializer ABI must stay static in
     * Noir/Aztec interfaces. Only the first `recipient_count` entries are used;
     * addresses beyond that can be arbitrary placeholders.
     *
     * @param recipient_count Number of active shard recipients (max `MAX_RECIPIENTS`).
     * @param threshold Minimum number of shards required to reconstruct the secret.
     * @param recipient_0..recipient_7 Recipient slots; only the active prefix is stored.
     */
    fn constructor(
        recipient_count: u32,
        threshold: u32,
        recipient_0: AztecAddress,
        recipient_1: AztecAddress,
        recipient_2: AztecAddress,
        recipient_3: AztecAddress,
        recipient_4: AztecAddress,
        recipient_5: AztecAddress,
        recipient_6: AztecAddress,
        recipient_7: AztecAddress,
    ) {
        assert(recipient_count > 0, "Recipient count must be greater than zero");
        assert(recipient_count <= MAX_RECIPIENTS, "Recipient count too large");
        assert(threshold > 0, "Threshold must be greater than zero");
        assert(threshold <= recipient_count, "Threshold cannot exceed recipients");

        let recipients: [AztecAddress; MAX_RECIPIENTS] = [
            recipient_0,
            recipient_1,
            recipient_2,
            recipient_3,
            recipient_4,
            recipient_5,
            recipient_6,
            recipient_7,
        ];

        self.storage.recipient_count.initialize(recipient_count);
        self.storage.threshold.initialize(threshold);

        for i in 0..MAX_RECIPIENTS {
            if i < recipient_count {
                self.storage.recipients.at(i).initialize(recipients[i]);
            }
        }
    }

    #[external("utility")]
    unconstrained fn get_recipient_count() -> pub u32 {
        self.storage.recipient_count.read()
    }

    #[external("utility")]
    unconstrained fn get_threshold() -> pub u32 {
        self.storage.threshold.read()
    }

    #[external("utility")]
    unconstrained fn get_recipient(index: u32) -> pub AztecAddress {
        assert(index < self.storage.recipient_count.read(), "Recipient index out of bounds");
        self.storage.recipients.at(index).read()
    }

    #[external("private")]
    /**
     * Generate and emit one shard per active recipient.
     *
     * Shares are evaluated at x = 1..recipient_count from a deterministic polynomial
     * whose constant term is the disclosed secret and whose higher coefficients are
     * derived from `context`.
     *
     * @param from Original certificate owner associated with emitted shards.
     * @param context Disclosure context used in events and coefficient derivation.
     * @param _guardian Unused in this implementation (kept for interface compatibility).
     * @param _unique_id Unused in this implementation (kept for interface compatibility).
     * @param content_type Certificate content type; must match ZK KYC.
     * @param content_note_0 KYC personal note; surname index is used as secret.
     * @param _content_note_1 Unused in this implementation (kept for interface compatibility).
     */
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
        let recipient_count = self.storage.recipient_count.read();
        let threshold = self.storage.threshold.read();

        // Deterministic polynomial per context:
        // y = secret + c1*x + c2*x^2 + ... + c_(threshold-1)*x^(threshold-1)
        // with coefficients c_i derived from context.
        for recipient_index in 0..MAX_RECIPIENTS {
            if recipient_index < recipient_count {
                let shard_x = Field::from(recipient_index + 1);

                let mut shard_y = secret;
                let mut x_power = shard_x;
                for degree_index in 0..MAX_RECIPIENTS {
                    if degree_index + 1 < threshold {
                        let coeff = context + Field::from(SHARD_COEFF_SALT + degree_index);
                        shard_y = shard_y + coeff * x_power;
                    }
                    x_power = x_power * shard_x;
                }

                self
                    .emit(ShamirDisclosureShardEvent { from, context, shard_x, shard_y })
                    .deliver_to(
                        self.storage.recipients.at(recipient_index).read(),
                        MessageDelivery.CONSTRAINED_ONCHAIN,
                    );
            }
        }
    }
}
