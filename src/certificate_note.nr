use aztec::{macros::notes::note, protocol_types::{address::AztecAddress, traits::Packable}};

// CertificateNote is a private note that stores a certificate of the user as issued by a guardian
// These notes remain private. Only the owner can read and use it.
// Not even the issuing guardian can track the usage.
#[derive(Eq, Packable)]
#[note]
pub struct CertificateNote {
    // The user who holds the certificate (only they can read it)
    pub owner: AztecAddress,

    // The guardian who issued the certificate
    pub guardian: AztecAddress,

    // The certificate data
    pub unique_id: Field,
    // We omit a generic expiration date. Guardians can revoke the certificate if needed, so we keep it simple for the user.
}

impl CertificateNote {
    // Creates a new note with the certificate data
    pub fn new(owner: AztecAddress, guardian: AztecAddress, unique_id: Field) -> Self {
        Self { owner, guardian, unique_id }
    }

    // Helper method to access the note data
    pub fn get(self) -> Self {
        Self { owner: self.owner, guardian: self.guardian, unique_id: self.unique_id }
    }
}
