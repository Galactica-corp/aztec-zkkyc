/**
 * ZK KYC Certificate Registry Contract
 *
 * This contract is used for Galactica's ZK KYC system on Aztec.
 * Flow:
 * 1. User completes the KYC process with a KYC guardian
 * 2. KYC guardian creates a certificate and issues it as private state in the contract
 * 3. User receives the KYC certificate from the private state
 * 4. User can privately show that he holds a valid KYC certificate
 * 5. The guardian may revoke the certificate
 * 
 * Notes:
 * - ZK KYC is the primary use case, but the same certificate registry can also be used for other use cases, e.g. representing educational certificates.
 */

use dep::aztec::macros::aztec;

mod certificate_note;
mod content_note;
pub mod content;
mod test;

// Re-export for dependents' tests (e.g. use_case_example)
pub use test::utils::sample_kyc_content;

#[aztec]
pub contract CertificateRegistry {
    use dep::aztec::{
        authwit::auth::compute_authwit_nullifier,
        macros::{functions::{authorize_once, external, initializer, only_self}, storage::storage},
        messages::message_delivery::MessageDelivery,
        note::{
            note_getter_options::NoteGetterOptions, note_interface::NoteProperties,
            note_viewer_options::NoteViewerOptions,
        },
        utils::comparison::Comparator,
    };
    use dep::aztec::protocol_types::address::AztecAddress;
    use dep::aztec::state_vars::{
        delayed_public_mutable::DelayedPublicMutable, Map, Owned, PrivateSet, PublicMutable,
    };

    use crate::certificate_note::CertificateNote;
    use crate::content::CONTENT_TYPE_ZK_KYC;
    use crate::content_note::ContentNote;
    use dep::requirement_checker_interface::RequirementCheckerInterface;

    global REVOCATION_DELAY: u64 = 12 * 60 * 60; // 12 hours

    #[storage]
    struct Storage<Context> {
        // Contract administrator address
        admin: PublicMutable<AztecAddress, Context>,

        // Whitelisted guardian addresses
        guardian_whitelist: Map<AztecAddress, PublicMutable<bool, Context>, Context>,

        // Private Certificates of the user
        certificates: Owned<PrivateSet<CertificateNote, Context>, Context>,

        // Private certificate content notes (KYC personal, address, etc.)
        content_notes: Owned<PrivateSet<ContentNote, Context>, Context>,

        // Public disclosures (optional, the certificates can also be used privately only)
        // User address -> public KYC ok flag
        public_disclosures: Map<AztecAddress, PublicMutable<bool, Context>, Context>,

        // Copy of issued certificates for the guardian, so that the guardian keep track of existing certificates in private.
        guardian_certificates_copies: Owned<PrivateSet<CertificateNote, Context>, Context>,

        // Revocation map (delayed to be accessed in private transactions, true if revoked, false if not)
        revocation_list: Map<Field, DelayedPublicMutable<bool, REVOCATION_DELAY, Context>, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        self.storage.admin.write(admin);
    }

    /**
     * Whitelist a guardian to that he can issue certificates.
     * @param guardian - The guardian address to whitelist
     */
    #[external("public")]
    fn whitelist_guardian(guardian: AztecAddress) {
        assert(self.context.msg_sender().unwrap().eq(self.storage.admin.read()));
        self.storage.guardian_whitelist.at(guardian).write(true);
    }

    /**
     * Remove a guardian from the whitelist.
     * @param guardian - The guardian address to whitelist
     */
    #[external("public")]
    fn remove_guardian_from_whitelist(guardian: AztecAddress) {
        assert(self.context.msg_sender().unwrap().eq(self.storage.admin.read()));
        self.storage.guardian_whitelist.at(guardian).write(false);
    }

    /**
     * Issue a certificate to a user.
     * @param user - The user address to issue the certificate to
     * @param unique_id - Unique identifier for the certificate
     * @param revocation_id - Id for revocation (must be unique)
     * @param content_type - Content type (e.g. CONTENT_TYPE_ZK_KYC for gip1)
     * @param content_note_data_0 - First content note payload (8 fields). E.g. KYC personal when content_type is ZK_KYC.
     * @param content_note_data_1 - Second content note payload (8 fields). E.g. KYC address when content_type is ZK_KYC.
     */
    #[external("private")]
    fn issue_certificate(
        user: AztecAddress,
        unique_id: Field,
        revocation_id: Field,
        content_type: Field,
        content_note_data_0: [Field; 8],
        content_note_data_1: [Field; 8],
    ) {
        let guardian = self.context.msg_sender().unwrap();

        self.enqueue_self._check_guardian_whitelisted(guardian);

        let certificate = CertificateNote::new(guardian, unique_id, revocation_id, content_type);
        self.storage.certificates.at(user).insert(certificate).deliver(
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );

        // Test that the certificate has not been revoked already. This check might miss duplicates in the rare case due to the delay.
        assert_eq(
            self.storage.revocation_list.at(revocation_id).get_current_value(),
            false,
            "Revocation id already used",
        );

        // Create content notes for KYC
        if content_type.eq(CONTENT_TYPE_ZK_KYC) {
            let content_note_0 = ContentNote::new(unique_id + 0, content_note_data_0);
            self.storage.content_notes.at(user).insert(content_note_0).deliver(
                MessageDelivery.CONSTRAINED_ONCHAIN,
            );

            let content_note_1 = ContentNote::new(unique_id + 1, content_note_data_1);
            self.storage.content_notes.at(user).insert(content_note_1).deliver(
                MessageDelivery.CONSTRAINED_ONCHAIN,
            );
        }

        // Give the guardian a copy of the certificate note to remember the revocation-nullifier
        self.storage.guardian_certificates_copies.at(guardian).insert(certificate).deliver(
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );
    }

    /**
     * Check the guardian's whitelist status.
     * @param guardian - The guardian address to check
     */
    #[external("public")]
    #[only_self]
    fn _check_guardian_whitelisted(guardian: AztecAddress) {
        assert(
            self.storage.guardian_whitelist.at(guardian).read().eq(true),
            "Guardian not whitelisted",
        );
    }

    /**
     * Revoke a certificate by setting the revocation flag to true.
     * @dev The revocation is delayed so that it can be checked in private transactions.
     * @param revocation_id - The revocation-id to revoke the certificate with
     */
    #[external("private")]
    fn revoke_certificate(revocation_id: Field) {
        let guardian = self.context.msg_sender().unwrap();
        self.enqueue_self._check_guardian_whitelisted(guardian);

        let options = NoteGetterOptions::new()
            .select(CertificateNote::properties().revocation_id, Comparator.EQ, revocation_id)
            .set_limit(1);
        let certificate = self.storage.guardian_certificates_copies.at(guardian).pop_notes(options);
        assert(certificate.len() > 0, "No certificate found");

        // Set the revocation status to true
        self.enqueue_self._set_revocation_status(revocation_id, true);
    }

    /**
     * Set the revocation status for a given revocation-id.
     * @param revocation_id - The revocation-id to set the status for
     * @param status - The status to set (true if revoked, false if not)
     */
    #[external("public")]
    #[only_self]
    fn _set_revocation_status(revocation_id: Field, status: bool) {
        self.storage.revocation_list.at(revocation_id).schedule_value_change(status);
    }

    /**
     * Get the number of certificates owned by an address. Only usable by the owner.
     * @param owner - The address to get the number of certificates for
     * @return The number of certificates owned by the address
     */
    #[external("utility")]
    unconstrained fn get_certificate_count(owner: AztecAddress) -> pub u32 {
        let owned_certificates =
            self.storage.certificates.at(owner).view_notes(NoteViewerOptions::new());
        owned_certificates.len()
    }

    /**
     * Check if a user has a valid certificate.
     */
    #[authorize_once("from", "authwit_nonce")]
    #[external("private")]
    fn check_certificate(from: AztecAddress, authwit_nonce: Field) {
        let mut options = NoteGetterOptions::new().set_limit(1);

        let notes = self.storage.certificates.at(from).pop_notes(options);
        assert(notes.len() > 0, "No certificate found");

        // ensure that the issuing guardian is still whitelisted
        self.enqueue_self._check_guardian_whitelisted(notes.get(0).guardian);

        // Check that the note has not been revoked
        assert_eq(
            self.storage.revocation_list.at(notes.get(0).revocation_id).get_current_value(),
            false,
            "Certificate revoked",
        );

        // Put the certificate back into the storage to be used again
        self.storage.certificates.at(from).insert(notes.get(0)).deliver(
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );
    }

    /**
     * Check if a user has a valid certificate and that all requirement checkers pass.
     * @param from - The user address whose certificate to check
     * @param authwit_nonce - Nonce for the authwit
     * @param checker_address - Address of a contract implementing RequirementCheckerInterface
     */
    #[authorize_once("from", "authwit_nonce")]
    #[external("private")]
    fn check_certificate_and_requirements(
        from: AztecAddress,
        authwit_nonce: Field,
        checker_address: AztecAddress,
    ) {
        let mut options = NoteGetterOptions::new().set_limit(1);

        let notes = self.storage.certificates.at(from).pop_notes(options);
        assert(notes.len() > 0, "No certificate found");

        let certificate = notes.get(0);

        // Ensure that the issuing guardian is still whitelisted
        self.enqueue_self._check_guardian_whitelisted(certificate.guardian);

        // Check that the note has not been revoked
        assert_eq(
            self.storage.revocation_list.at(certificate.revocation_id).get_current_value(),
            false,
            "Certificate revoked",
        );

        // Pop content notes to get data for requirement check
        let getter_0 = NoteGetterOptions::new()
            .select(ContentNote::properties().content_id, Comparator.EQ, certificate.unique_id + 0)
            .set_limit(1);
        let getter_1 = NoteGetterOptions::new()
            .select(ContentNote::properties().content_id, Comparator.EQ, certificate.unique_id + 1)
            .set_limit(1);
        let popped_0 = self.storage.content_notes.at(from).pop_notes(getter_0);
        let popped_1 = self.storage.content_notes.at(from).pop_notes(getter_1);
        assert(popped_0.len() > 0, "Content note 0 not found");
        assert(popped_1.len() > 0, "Content note 1 not found");
        let note_0 = popped_0.get(0);
        let note_1 = popped_1.get(0);

        // Call the requirement checker (using generic interface to allow for different content types and requirements)
        self.call(RequirementCheckerInterface::at(checker_address).check_requirements(
            certificate.content_type,
            note_0.data,
            note_1.data,
        ));

        // Put content notes back
        self.storage.content_notes.at(from).insert(note_0).deliver(
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );
        self.storage.content_notes.at(from).insert(note_1).deliver(
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );

        // Put the certificate back into the storage to be used again
        self.storage.certificates.at(from).insert(certificate).deliver(
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );
    }

    /**
     * Cancel a private authentication witness for checking a certificate.
     * From https://docs.aztec.network/developers/docs/aztec-nr/framework-description/how_to_use_authwit
     * @param inner_hash The inner hash of the authwit to cancel.
     */
    #[external("private")]
    fn cancel_authwit(inner_hash: Field) {
        let on_behalf_of = self.msg_sender().unwrap();
        let nullifier = compute_authwit_nullifier(on_behalf_of, inner_hash);
        self.context.push_nullifier(nullifier);
    }
}
