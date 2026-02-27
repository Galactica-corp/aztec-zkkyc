// Return types for utility functions (one certificate per page, deserializable in Noir tests).

use dep::aztec::protocol::traits::{Deserialize, Serialize};

#[derive(Deserialize, Eq, Serialize)]
pub struct UserCertificatesPage {
    pub count: u32,
    pub guardian: Field,
    pub unique_id: Field,
    pub revocation_id: Field,
    pub content_type: Field,
    pub content_0_id: Field,
    pub content_0_data: [Field; 7],
    pub content_1_id: Field,
    pub content_1_data: [Field; 7],
    pub has_more: bool,
}

#[derive(Deserialize, Eq, Serialize)]
pub struct GuardianCertificatesPage {
    pub count: u32,
    pub guardian: Field,
    pub unique_id: Field,
    pub revocation_id: Field,
    pub content_type: Field,
    pub has_more: bool,
}
