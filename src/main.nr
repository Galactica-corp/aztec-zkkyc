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
mod test;

#[aztec]
pub contract CertificateRegistry {
    use dep::aztec::{
        macros::{functions::{external, initializer, only_self}, storage::storage},
        messages::message_delivery::MessageDelivery,
        note::{note_getter_options::NoteGetterOptions, note_viewer_options::NoteViewerOptions},
    };
    use dep::aztec::protocol_types::address::AztecAddress;
    use dep::aztec::state_vars::{Map, Owned, PrivateSet, PublicMutable};

    use crate::certificate_note::CertificateNote;

    #[storage]
    struct Storage<Context> {
        // Contract administrator address
        admin: PublicMutable<AztecAddress, Context>,

        // Whitelisted guardian addresses
        guardian_whitelist: Map<AztecAddress, PublicMutable<bool, Context>, Context>,

        // Private Certificates of the user
        certificates: Owned<PrivateSet<CertificateNote, Context>, Context>,

        // Public disclosures (optional, the certificates can also be used privately only)
        // User address -> public KYC ok flag
        public_disclosures: Map<AztecAddress, PublicMutable<bool, Context>, Context>,
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
     * @param certificate - The certificate to issue
     */
    #[external("private")]
    fn issue_certificate(user: AztecAddress, unique_id: Field) {
        let guardian = self.context.msg_sender().unwrap();

        self.enqueue_self._check_guardian_whitelisted(guardian);

        self
            .storage
            .certificates
            .at(user)
            .insert(CertificateNote::new(user, guardian, unique_id))
            .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
    }

    /**
     * Check the guardian's whitelist status.
     * @param guardian - The guardian address to check
     */
    #[external("public")]
    #[only_self]
    fn _check_guardian_whitelisted(guardian: AztecAddress) {
        assert(self.storage.guardian_whitelist.at(guardian).read(), "Guardian not whitelisted");
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
    #[external("private")]
    fn check_certificate() {
        let user = self.context.msg_sender().unwrap();

        let mut options = NoteGetterOptions::new().set_limit(1);

        // TODO: Add non revocation filter/check

        let notes = self.storage.certificates.at(user).get_notes(options);
        assert(notes.len() > 0, "No certificate found");

        // ensure that the issuing guardian is still whitelisted
        self.enqueue_self._check_guardian_whitelisted(notes.get(0).note.guardian);
    }
}
