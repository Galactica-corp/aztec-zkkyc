use aztec::{macros::notes::note, protocol::{address::AztecAddress, traits::Packable}};

// CertificateNote is a private note that stores a certificate of the user as issued by a guardian
// These notes remain private. Only the owner can read and use it.
// Not even the issuing guardian can track the usage.
#[derive(Eq, Packable)]
#[note]
pub struct CertificateNote {
    // The guardian who issued the certificate
    pub guardian: AztecAddress,

    // The certificate data
    pub unique_id: Field,

    // A random id that can be used to revoke the certificate, assumed to be unique
    pub revocation_id: Field,

    // Content type (maps to KnownZkCertStandard: 1=gip1, 2=gip2, etc.)
    pub content_type: Field,
    // We omit a generic expiration date. Guardians can revoke the certificate if needed, so we keep it simple for the user.
}

impl CertificateNote {
    // Creates a new note with the certificate data
    pub fn new(
        guardian: AztecAddress,
        unique_id: Field,
        revocation_id: Field,
        content_type: Field,
    ) -> Self {
        Self { guardian, unique_id, revocation_id, content_type }
    }

    // Helper method to access the note data
    pub fn get(self) -> Self {
        Self {
            guardian: self.guardian,
            unique_id: self.unique_id,
            revocation_id: self.revocation_id,
            content_type: self.content_type,
        }
    }
}
