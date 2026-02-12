// ContentNote is a private note that holds certificate content data split across multiple notes.
// Links to a certificate via content_id = unique_id + content_index.
// Generic: holds an array of Fields for various content types (KYC personal, address, etc.).

use aztec::{macros::notes::note, protocol_types::traits::Packable};

#[derive(Eq, Packable)]
#[note]
pub struct ContentNote {
    // Links to certificate: unique_id + content_index
    pub content_id: Field,

    // Generic payload (8 fields to stay within 10-field note limit)
    pub data: [Field; 8],
}

impl ContentNote {
    pub fn new(content_id: Field, data: [Field; 8]) -> Self {
        Self { content_id, data }
    }
}
